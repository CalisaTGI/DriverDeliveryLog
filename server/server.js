import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import { deleteLocation } from './locationStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

let db;

// Configure your Nodemailer email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'christiankentremo@gmail.com',
    pass: 'codhasarlgvexfrf'
  }
});

initDb().then(async (dbInstance) => {
  db = dbInstance;
  
  // Ensure client_email column exists in delivery_requests table
  try {
    await db.run(`ALTER TABLE delivery_requests ADD COLUMN client_email TEXT;`);
  } catch (e) {
    // Column already exists, safe to ignore
  }

  console.log('Successfully connected to the SQLite Database file.');
  app.listen(PORT, () => {
    console.log(`Backend service listening actively on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Critical database execution boot error:', err);
});

/* ── BACKEND API ENDPOINTS ────────────────────────────────────────── */

app.get('/api/locations', async (req, res) => {
  try {
    const rows = await db.all('SELECT name FROM locations ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read locations table.' });
  }
});

app.post('/api/locations', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Location text name cannot be empty." });
  }
  try {
    await db.run('INSERT OR IGNORE INTO locations (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ success: true, message: "Location saved permanently." });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write custom location entry to disk.' });
  }
});

app.delete('/api/locations', async (req, res) => {
  const { name } = req.body || {};
  try {
    const removed = await deleteLocation(db, name);
    if (removed) {
      res.json({ success: true, message: 'Location removed successfully.' });
    } else {
      res.status(404).json({ error: 'Location not found.' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to remove location.' });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const rows = await db.all('SELECT name FROM drivers ORDER BY name ASC');
    res.json(rows.map(row => row.name));
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract active drivers list' });
  }
});

app.post('/api/submit-day', async (req, res) => {
  const { date, driver, jobs, arrivalBackTime, clientTxId } = req.body;

  if (!driver || !jobs || jobs.length === 0) {
    return res.status(400).json({ error: 'Incomplete payload context data rows detected.' });
  }

  try {
    if (clientTxId) {
      const existing = await db.get('SELECT id FROM delivery_logs WHERE client_tx_id = ? LIMIT 1', [clientTxId]);
      if (existing) {
        return res.status(200).json({ success: true, duplicate: true, message: 'Log session already archived to database.' });
      }
    }

    for (const job of jobs) {
      const totalJobTime = job.totalTime || calcJobDuration(job.startTime, job.stopTime);

      await db.run(
        `INSERT INTO delivery_logs 
        (client_tx_id, log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time, signature) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientTxId || null,
          date,
          driver,
          job.jobNumber,
          job.task,
          job.paperwork ? 1 : 0,
          job.location,
          job.startTime,
          job.stopTime,
          totalJobTime,
          arrivalBackTime || "—",
          req.body.signature || null
        ]
      );
    }
    res.status(201).json({ success: true, message: 'All logs successfully archived to database.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal failure writing records to database.' });
  }
});

// Save a new delivery request along with client email and signature
app.post('/api/delivery-requests', async (req, res) => {
  const {
    jobNumber, task, description, date,
    deliverTo, workFor, instructions, details,
    receivedByName, receiveDate, clientSignature, internalUse,
    clientEmail: bodyClientEmail,
    client_email: bodyClientEmailSnake
  } = req.body;

  const clientEmail = bodyClientEmail || bodyClientEmailSnake || '';

  if (!jobNumber || !clientSignature) {
    return res.status(400).json({ error: 'Job number and client signature are required.' });
  }

  try {
    await db.run(
      `INSERT INTO delivery_requests 
      (job_number, task, description, date, deliver_to, work_for, instructions, details, received_by_name, receive_date, client_signature, internal_use, status, client_email) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobNumber,
        task || '',
        description || '',
        date || '',
        JSON.stringify(deliverTo || {}),
        JSON.stringify(workFor || {}),
        instructions || '',
        details || '',
        receivedByName || '',
        receiveDate || '',
        clientSignature,
        JSON.stringify(internalUse || {}),
        'completed',
        clientEmail
      ]
    );

    // Send confirmation email to the client with full form layout and signature
    if (clientEmail && clientEmail.trim() !== '') {
      const attachments = [];

      // 1. Process Signature Image Attachment
      let signatureImgHtml = '<span style="color:#777;">No signature</span>';
      if (clientSignature && clientSignature.startsWith('data:image')) {
        const matches = clientSignature.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          attachments.push({
            filename: 'signature.png',
            content: Buffer.from(matches[2], 'base64'),
            cid: 'clientsig'
          });
        }
      }

      // 2. Process Logo Attachment with expanded directory scanning
      const possibleLogoPaths = [
        path.join(__dirname, 'TGI-logo.png'),
        path.join(__dirname, 'public', 'TGI-logo.png'),
        path.join(__dirname, '../TGI-logo.png'),
        path.join(__dirname, '../public', 'TGI-logo.png'),
        path.join(process.cwd(), 'TGI-logo.png'),
        path.join(process.cwd(), 'public', 'TGI-logo.png'),
        path.join(process.cwd(), 'frontend', 'public', 'TGI-logo.png')
      ];

      let logoPath = null;
      for (const p of possibleLogoPaths) {
        if (fs.existsSync(p)) {
          logoPath = p;
          break;
        }
      }

      let logoHtml = '<b style="font-size: 14px;">TGI DIRECT</b>';
      if (logoPath) {
        console.log('✅ TGI-logo.png successfully attached from:', logoPath);
        attachments.push({
          filename: 'TGI-logo.png',
          path: logoPath,
          cid: 'tgilogo'
        });
      } else {
        console.warn('⚠️ TGI-logo.png could not be located. Checked paths:', possibleLogoPaths);
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `Delivery Request Confirmation - #${jobNumber}`,
        attachments,
        html: `
          <div style="max-width: 650px; margin: 0 auto; font-family: Arial, sans-serif; color: #000; font-size: 12px; border: 1px solid #444; padding: 15px; background: #fff;">
            <h2 style="color: #111;">TGI Direct - Delivery Request Confirmation</h2>
            <p>Hi <strong>${receivedByName || 'Valued Client'}</strong>,</p>
            <p>Thank you! Your signature has been successfully captured and recorded for delivery request job <strong>#${jobNumber}</strong>.</p>
            <p>Here is your signed delivery request form copy:</p>
            <div style="border: 1px solid #000; padding: 20px; background-color: #fff;">
            
            <!-- HEADER SECTION -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
              <tr>
                <td style="vertical-align: top; width: 40%; padding-right: 6px;">
                  <img src="cid:tgilogo" alt="TGI Direct" style="max-width:80px; height: auto; display: block; margin-bottom: 4px;" />
                  <div style="font-weight: bold; font-size: 8px; line-height: 1.2; color: #000;">Marketing Support Services</div>
                  <div style="font-size: 6px; color: #333; line-height: 1.2;">
                    P.O. Box, Flint, MI 48507-0354<br />
                    (800) 337-2237 Fax (810) 239-4321<br />
                    www.tgidirect.com
                  </div>
                </td>
                <td style="vertical-align: middle; width: 60%; text-align: right;">
                  <table width="100%" style="border: 1px solid #000; text-align: center; border-collapse: collapse;">
                    <tr>
                      <td colspan="4" style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 2px; font-size: 10px;">Delivery Request</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #000; font-size: 8px;">
                      <td style="border-right: 1px solid #000; padding: 2px; font-weight: bold; width: 22%;">Job</td>
                      <td style="border-right: 1px solid #000; padding: 2px; font-weight: bold; width: 16%;">Task</td>
                      <td style="border-right: 1px solid #000; padding: 2px; font-weight: bold; width: 30%;">Description</td>
                     <td style="padding: 2px; font-weight: bold; width: 32%;">Date</td>
                    </tr>
                    <tr>
                      <td style="border-right: 1px solid #000; padding: 2px; font-size: 9px;">${jobNumber || '—'}</td>
                      <td style="border-right: 1px solid #000; padding: 2px; font-size: 9px;">${task || '—'}</td>
                      <td style="border-right: 1px solid #000; padding: 2px; font-size: 9px;">${description || '—'}</td>
                      <td style="padding: 2px; font-size: 9px; white-space: nowrap;">${date || '—'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- DELIVER TO & WORK FOR BLOCKS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
              <tr>
                <td style="width: 48%; border: 1px solid #000; vertical-align: top; padding: 0;">
                  <div style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 4px 6px;">Deliver To:</div>
                  <div style="padding: 6px; font-size: 11px; line-height: 1.4;">
                    <b>${deliverTo?.name || ''}</b><br/>
                    ${deliverTo?.company || ''}<br/>
                    ${deliverTo?.address1 || ''}<br/>
                    ${deliverTo?.address2 || ''}
                  </div>
                </td>
                <td style="width: 4%;"></td>
                <td style="width: 48%; border: 1px solid #000; vertical-align: top; padding: 0;">
                  <div style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 4px 6px;">Work For:</div>
                  <div style="padding: 6px; font-size: 11px; line-height: 1.4;">
                    <b>${workFor?.company || ''}</b><br/>
                    ${workFor?.address1 || ''}<br/>
                    ${workFor?.address2 || ''}
                  </div>
                </td>
              </tr>
            </table>

            <!-- INSTRUCTIONS -->
            <div style="border: 1px solid #000; margin-bottom: 10px;">
              <div style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 4px 6px;">Instructions:</div>
              <div style="padding: 6px; font-size: 11px;">${instructions || '—'}</div>
            </div>

            <!-- DETAILS -->
            <div style="border: 1px solid #000; margin-bottom: 10px;">
              <div style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 4px 6px;">Details:</div>
              <div style="padding: 6px; font-size: 11px; white-space: pre-line; min-height: 40px;">${details || '—'}</div>
            </div>

            <!-- RECEIVED BY & SIGNATURE -->
            <div style="border: 1px solid #000; padding: 8px; margin-bottom: 10px;">
              <table style="width: 100%; font-size: 11px; margin-bottom: 8px;">
                <tr>
                  <td><b>Received By:</b> ${receivedByName || '—'}</td>
                  <td><b>Date:</b> ${receiveDate || date || '—'}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 6px;"><b>Client Email:</b> ${clientEmail || '—'}</td>
                </tr>
              </table>
              <div style="margin-top: 6px;">
                <b>Client Signature:</b><br/>
                <div style="border: 1px dashed #777; background: #fafafa; padding: 4px; display: inline-block; margin-top: 4px;">
                  <img src="cid:clientsig" alt="Client Signature" style="max-height: 50px; display: block; margin: 0 auto;" />
                </div>
              </div>
            </div>

            <!-- TGI INTERNAL USE -->
            <div style="border: 1px solid #000; margin-bottom: 10px; font-size: 10px;">
              <div style="background: #e2e2e2; border-bottom: 1px solid #000; font-weight: bold; padding: 4px 6px;">TGI Internal Use:</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border-bottom: 1px solid #000;">
                <tr>
                  <td width="33%" style="border-right: 1px solid #000; padding: 4px; vertical-align: top;"><b>Driver:</b> ${internalUse?.driver || '—'}</td>
                  <td width="34%" style="border-right: 1px solid #000; padding: 4px; vertical-align: top;"><b>Vehicle:</b> ${internalUse?.vehicle || '—'}</td>
                  <td width="33%" style="padding: 4px; vertical-align: top;"><b>Zone:</b> ${internalUse?.zone || '—'}</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="25%" style="border-right: 1px solid #000; padding: 4px; vertical-align: top;"><b>Bill:</b> ${internalUse?.bill || '—'}</td>
                  <td width="25%" style="border-right: 1px solid #000; padding: 4px; vertical-align: top;"><b>Hrs:</b> ${internalUse?.hrs || '—'}</td>
                  <td width="25%" style="border-right: 1px solid #000; padding: 4px; vertical-align: top;"><b>Min:</b> ${internalUse?.min || '—'}</td>
                  <td width="25%" style="padding: 4px; vertical-align: top;"><b>By:</b> ${internalUse?.by || '—'}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; color: #555; font-size: 10px; margin-top: 15px;">
              This is an official automated copy of your signed delivery request form with TGI Direct.
            </div>
          </div>
          
          <p style="margin-top: 20px;">If you have any questions, please feel free to reach out to our team.</p>
            <p style="margin-top: 20px;">
            Best regards,<br><br>
            <strong>TGI Direct Operations Team</strong>
          </p>
        </div>
        `
      };

      transporter.sendMail(mailOptions, (mailErr, info) => {
        if (mailErr) {
          console.error('Error sending confirmation email to client:', mailErr);
        } else {
          console.log('Confirmation email sent successfully:', info.response);
        }
      });
    }

    res.status(201).json({ success: true, message: 'Delivery request saved successfully with signature and email sent.' });
  } catch (error) {
    console.error('Database write error for delivery request:', error);
    res.status(500).json({ error: 'Failed to save delivery request to database.' });
  }
});

// Fetch all delivery requests
app.get('/api/delivery-requests', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM delivery_requests ORDER BY id DESC');
    const formattedRows = rows.map(row => ({
      ...row,
      clientEmail: row.client_email || '',
      deliverTo: JSON.parse(row.deliver_to || '{}'),
      workFor: JSON.parse(row.work_for || '{}'),
      internalUse: JSON.parse(row.internal_use || '{}')
    }));
    res.json(formattedRows);
  } catch (error) {
    console.error('Fetch delivery requests error:', error);
    res.status(500).json({ error: 'Failed to extract delivery requests from database.' });
  }
});

app.delete('/api/delivery-logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run('DELETE FROM delivery_logs WHERE id = ?', [id]);
    if (result.changes > 0) {
      res.json({ success: true, message: `Log #${id} deleted successfully.` });
    } else {
      res.status(404).json({ error: `Log #${id} not found.` });
    }
  } catch (error) {
    console.error('Delete log error:', error);
    res.status(500).json({ error: 'Failed to delete record from database.' });
  }
});

app.delete('/api/delivery-logs', async (req, res) => {
  try {
    await db.run('DELETE FROM delivery_logs');
    res.json({ success: true, message: 'All delivery logs cleared successfully.' });
  } catch (error) {
    console.error('Purge logs error:', error);
    res.status(500).json({ error: 'Failed to purge records from database.' });
  }
});

app.get('/api/billing-export', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database warming up.' });
    const { start, end } = req.query;
    let query = `
      SELECT id, log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time, signature
      FROM delivery_logs 
    `;
    const params = [];
    if (start && end) {
      query += ` WHERE log_date BETWEEN ? AND ? `;
      params.push(start, end);
    }
    query += ` ORDER BY log_date DESC, id DESC`;
    const records = await db.all(query, params);
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ error: 'Administrative read broken.' });
  }
});

app.get('/api/billing/export-csv', async (req, res) => {
  try {
    if (!db) return res.status(503).send('Database warming up.');
    const { start, end } = req.query;
    let query = `
      SELECT log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time 
      FROM delivery_logs 
    `;
    const params = [];
    if (start && end) {
      query += ` WHERE log_date BETWEEN ? AND ? `;
      params.push(start, end);
    }
    query += ` ORDER BY log_date DESC, id ASC`;
    const records = await db.all(query, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Delivery Logs');

    const columnDefinitions = [
      { header: 'Date', key: 'date' },
      { header: 'Driver', key: 'driver' },
      { header: 'Job Number', key: 'jobNum' },
      { header: 'Task Letter', key: 'task' },
      { header: 'Paperwork', key: 'paperwork' },
      { header: 'Pick Up / Delivery Location', key: 'location' },
      { header: 'Start Time', key: 'start' },
      { header: 'Stop Time', key: 'stop' },
      { header: 'Total Time', key: 'total' },
      { header: 'Arrival Time Back at Building', key: 'backTime' }
    ];

    worksheet.columns = columnDefinitions.map(col => ({
      ...col,
      width: col.header.length + 3
    }));

    worksheet.insertRow(1, ['Driver Delivery Time Logs']);
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF333333' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }; 
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).font = { bold: true };

    let totalMinutesSum = 0;
    records.forEach((r) => {
      const paperworkStatus = r.paperwork === 1 ? 'YES' : '—';
      const taskClean = String(r.task_letter || '—').toUpperCase();

      if (r.total_time && r.total_time !== '—') {
        const match = r.total_time.match(/(\d+)h\s*(\d+)m/);
        if (match) {
          totalMinutesSum += (parseInt(match[1], 10) * 60) + parseInt(match[2], 10);
        }
      }

      const rowData = {
        date: r.log_date,
        driver: r.driver_name,
        jobNum: r.job_number,
        task: taskClean,
        paperwork: paperworkStatus,
        location: r.location || '—',
        start: r.start_time,
        stop: r.stop_time,
        total: r.total_time,
        backTime: r.arrival_back_time
      };

      const newRow = worksheet.addRow(rowData);
      if (newRow.number >= 3) {
        worksheet.columns.forEach(col => {
          const cellValue = rowData[col.key];
          const cellLength = cellValue ? cellValue.toString().length : 0;
          if (cellLength + 4 > (col.width || 14)) {
              col.width = cellLength + 4;
          }
        });
      }
    });

    const calculatedHours = Math.floor(totalMinutesSum / 60);
    const calculatedMinutes = totalMinutesSum % 60;
    const finalTotalTimeStr = `${calculatedHours}h ${calculatedMinutes}m`;

    worksheet.addRow([]);
    const signatureRowData = {
      date: 'Driver Signature:',
      total: 'Total Drive Time:',
      backTime: finalTotalTimeStr
    };
    worksheet.addRow(signatureRowData);
    worksheet.getRow(worksheet.rowCount).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const fileName = start && end ? `Delivery_Logs_${start}_to_${endDate}.xlsx` : `Driver_Delivery_Time_Log.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`); 

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel generation error:", err);
    res.status(500).send("Administrative data pipeline export broken.");
  }
});

function calcJobDuration(start, stop) {
  if (!start || !stop) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = stop.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}