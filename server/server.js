import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs'; // 🟢 Upgraded to a live Excel spreadsheet compiler
import { initDb } from './database.js';
import { deleteLocation } from './locationStore.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let db;

// Establish database engine instance connection and begin routing
initDb().then((dbInstance) => {
  db = dbInstance;
  console.log('Successfully connected to the SQLite Database file.');
  app.listen(PORT, () => {
    console.log(`Backend service listening actively on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Critical database execution boot error:', err);
});

/* ── BACKEND API ENDPOINTS ────────────────────────────────────────── */

// Fetch all permanently saved location entries
app.get('/api/locations', async (req, res) => {
  try {
    const rows = await db.all('SELECT name FROM locations ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read locations table.' });
  }
});

// Save a brand-new custom location into the database for future dropdown loops
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

// Remove a saved location from the dropdown list
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

// Fetch the driver selection roster from the database
app.get('/api/drivers', async (req, res) => {
  try {
    const rows = await db.all('SELECT name FROM drivers ORDER BY name ASC');
    res.json(rows.map(row => row.name));
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract active drivers list' });
  }
});

// Save full log session array payload when driver finishes their day
app.post('/api/submit-day', async (req, res) => {
  const { date, driver, jobs, arrivalBackTime, clientTxId } = req.body;

  if (!driver || !jobs || jobs.length === 0) {
    return res.status(400).json({ error: 'Incomplete payload context data rows detected.' });
  }

  try {
    // Check for duplicate submission using clientTxId
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
        (client_tx_id, log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          arrivalBackTime || "—"
        ]
      );
    }
    res.status(201).json({ success: true, message: 'All logs successfully archived to database.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal failure writing records to database.' });
  }
});

// Delete a specific delivery log by ID
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

// Delete all logs or clear database records
app.delete('/api/delivery-logs', async (req, res) => {
  try {
    await db.run('DELETE FROM delivery_logs');
    res.json({ success: true, message: 'All delivery logs cleared successfully.' });
  } catch (error) {
    console.error('Purge logs error:', error);
    res.status(500).json({ error: 'Failed to purge records from database.' });
  }
});


// Admin dashboard data feed for the billing/admin page
// Admin dashboard data feed (UPDATED for date filtering)
app.get('/api/billing-export', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database warming up.' });
    
    const { start, end } = req.query;
    let query = `
      SELECT id, log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time 
      FROM delivery_logs 
    `;
    const params = [];

    // Apply date filter if both start and end are provided
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

// EXPORT GATEWAY (UPDATED for date filtering)
app.get('/api/billing/export-csv', async (req, res) => {
  try {
    if (!db) return res.status(503).send('Database warming up.');

    const { start, end } = req.query;
    let query = `
      SELECT log_date, driver_name, job_number, task_letter, paperwork, location, start_time, stop_time, total_time, arrival_back_time 
      FROM delivery_logs 
    `;
    const params = [];

    // Apply date filter for the Excel export
    if (start && end) {
      query += ` WHERE log_date BETWEEN ? AND ? `;
      params.push(start, end);
    }
    
    query += ` ORDER BY log_date DESC, id ASC`;

    const records = await db.all(query, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Delivery Logs');

    // 1. Define columns (This initially places headers on Row 1)
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

    // Insert Title Row at the top (This pushes the headers down to Row 2)
    worksheet.insertRow(1, ['Driver Delivery Time Logs']);
    
    // Merge cells A1 through J1 (Columns 1 to 10) to center the title across the whole table
    // worksheet.mergeCells('A1:J1');
    
    // Style the new title cell
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF333333' } };

    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }; 

    //worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 30;
    // Bold the table column headers (which are now on Row 2)
    worksheet.getRow(2).font = { bold: true };

    let totalMinutesSum = 0;

    // 2. Add rows and check widths simultaneously 
    records.forEach((r, index) => {
      const paperworkStatus = r.paperwork === 1 ? 'YES' : '—';
      const taskClean = String(r.task_letter || '—').toUpperCase();

      if (r.total_time && r.total_time !== '—') {
        const match = r.total_time.match(/(\d+)h\s*(\d+)m/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          totalMinutesSum += (hours * 60) + minutes;
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

      // Width tracker
      if (newRow.number >= 3) {
        worksheet.columns.forEach(col => {
          const cellValue = rowData[col.key];
          const cellLength = cellValue ? cellValue.toString().length : 0;
          const minimumWidth = col.width || 14;
          if (cellLength + 4 > minimumWidth) {
              col.width = cellLength + 4;
          }
        });
      }
    });

    const calculatedHours = Math.floor(totalMinutesSum / 60);
    const calculatedMinutes = totalMinutesSum % 60;
    const finalTotalTimeStr = `${calculatedHours}h ${calculatedMinutes}m`;

    // Append signature formatting summaries smoothly
    worksheet.addRow([]);
    const signatureRowData = {
      date: 'Driver Signature:',
      total: 'Total Drive Time:',
      backTime: finalTotalTimeStr
    };
    worksheet.addRow(signatureRowData);

    // Ensure signature text doesn't cut off
    worksheet.columns.forEach(col => {
      const cellValue = signatureRowData[col.key];
      const cellLength = cellValue ? cellValue.toString().length : 0;
      if (cellLength + 3 > col.width) {
        col.width = cellLength + 3;
      }
    });

    // Bold the final total calculations row
    worksheet.getRow(worksheet.rowCount).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const fileName = start && end ? `Delivery_Logs_${start}_to_${end}.xlsx` : `Driver_Delivery_Time_Log.xlsx`;
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
  if (mins < 0) mins += 24 * 60; // Overnight shift compensation rule
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}