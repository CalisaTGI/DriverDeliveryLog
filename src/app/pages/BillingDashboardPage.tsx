import { useState, useEffect } from "react";
import { FileSpreadsheet, FileText, Loader, Search, CalendarDays, WifiOff, Trash2, Eye, ClipboardCheck, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { getApiUrl } from "../lib/apiConfig";
import { saveCachedLogsIdb, getCachedLogsIdb } from "../../offline/db";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { LogDetailsModal, DatabaseLog } from "../components/ui/LogDetailsModal";

const ENABLE_DELETE_ROW_UI = false;

export default function BillingDashboardPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "requests">("logs");

  const [logs, setLogs] = useState<DatabaseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineLoaded, setIsOfflineLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("All Drivers");

  // Delivery Requests state
  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Initialize dates: Default to the last 7 days
  const [startDate, setStartDate] = useState(() => {
    const local = new Date();
    local.setDate(local.getDate() - 7);
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split("T")[0];
  });

  const [endDate, setEndDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split("T")[0];
  });

  const [logToDelete, setLogToDelete] = useState<DatabaseLog | null>(null);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<DatabaseLog | null>(null);

  const confirmDeleteLog = async () => {
    if (!logToDelete) return;
    try {
      const res = await fetch(getApiUrl(`/api/delivery-logs/${logToDelete.id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned status ${res.status}`);
      }
      const updatedLogs = logs.filter((item) => item.id !== logToDelete.id);
      setLogs(updatedLogs);
      saveCachedLogsIdb(updatedLogs);
      toast.success(`Successfully deleted log record #${logToDelete.id}`);
    } catch (err: any) {
      console.error("Delete operation failed:", err);
      toast.error(err?.message || "Failed to delete log from server");
    } finally {
      setLogToDelete(null);
    }
  };

  // Fetch Delivery Logs
  useEffect(() => {
    setLoading(true);
    setIsOfflineLoaded(false);
    fetch(getApiUrl(`/api/billing-export?start=${startDate}&end=${endDate}`))
      .then((res) => {
        if (!res.ok) throw new Error("Server returned error status");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data);
          saveCachedLogsIdb(data);
        }
        setLoading(false);
      })
      .catch(async (err) => {
        console.warn("Failed to read log tables from network, trying IndexedDB cache:", err);
        const cached = await getCachedLogsIdb();
        if (cached && cached.length > 0) {
          setLogs(cached);
          setIsOfflineLoaded(true);
        } else {
          setLogs([]);
        }
        setLoading(false);
      });
  }, [startDate, endDate]);

  // Fetch Delivery Requests
  useEffect(() => {
    setLoadingRequests(true);
    fetch(getApiUrl('/api/delivery-requests'))
      .then((res) => {
        if (!res.ok) throw new Error("Server returned error status");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setDeliveryRequests(data);
        }
        setLoadingRequests(false);
      })
      .catch((err) => {
        console.error("Failed to load delivery requests:", err);
        setLoadingRequests(false);
      });
  }, []);

  const isIncompleteLog = (log: DatabaseLog) => {
    const hasJobNumber = !!log.job_number?.trim();
    const hasCompleteTime = !!log.start_time?.trim() && !!log.stop_time?.trim() && !!log.total_time?.trim();
    return !hasJobNumber || !hasCompleteTime;
  };

  const visibleLogs = logs.filter((log) => !isIncompleteLog(log));
  
  const uniqueLogDrivers = Array.from(new Set(visibleLogs.map((log) => log.driver_name))).sort();
  const uniqueRequestDrivers = Array.from(new Set(deliveryRequests.map((req) => {
    const internalUse = typeof req.internal_use === 'string' ? JSON.parse(req.internal_use || '{}') : (req.internalUse || req.internal_use || {});
    return internalUse.driver;
  }).filter(Boolean))).sort();

  const uniqueDrivers = activeTab === "logs" ? uniqueLogDrivers : uniqueRequestDrivers;

  const filteredLogs = visibleLogs.filter((log) => {
    const matchesDriver = selectedDriver === "All Drivers" ? true : log.driver_name === selectedDriver;
    const matchesSearch =
      (log.driver_name && log.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.job_number && log.job_number.includes(searchTerm));
    return matchesDriver && matchesSearch;
  });

  const filteredRequests = deliveryRequests.filter((req) => {
    const internalUse = typeof req.internal_use === 'string' ? JSON.parse(req.internal_use || '{}') : (req.internalUse || req.internal_use || {});
    const driverName = internalUse.driver || "";

    const matchesDriver = selectedDriver === "All Drivers" ? true : driverName === selectedDriver;
    const matchesDate = (!startDate || !req.date || req.date >= startDate) && (!endDate || !req.date || req.date <= endDate);

    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      (req.job_number && req.job_number.toLowerCase().includes(term)) ||
      (req.received_by_name && req.received_by_name.toLowerCase().includes(term)) ||
      (req.instructions && req.instructions.toLowerCase().includes(term)) ||
      (req.description && req.description.toLowerCase().includes(term)) ||
      (driverName.toLowerCase().includes(term))
    );

    return matchesDriver && matchesDate && matchesSearch;
  });

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const exportToExcel = async () => {
    const totalDriveMinutes = filteredLogs.reduce((sum, log) => {
      const match = log.total_time ? log.total_time.match(/(\d+)h\s*(\d+)m/) : null;
      if (!match) return sum;
      return sum + Number(match[1]) * 60 + Number(match[2]);
    }, 0);

    const totalDriveTime = totalDriveMinutes ? `${Math.floor(totalDriveMinutes / 60)}h ${totalDriveMinutes % 60}m` : "—";
    const driverNameForFile = selectedDriver === "All Drivers" ? "all" : selectedDriver.replace(/\s+/g, "_");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Delivery Logs');

    const titleRow = worksheet.addRow(['Driver Delivery Time Log']);
    worksheet.mergeCells('A1:J1');
    
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C5CFC' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headers = [
      "Date", "Driver", "Job Number", "Task Code", "Paperwork", 
      "Pick Up / Delivery Location", "Start Time", "Stop Time", "Total Time", "Signature", "Arrival Time Back at Building"
    ];
    const headerRow = worksheet.addRow(headers);
    
    headerRow.font = { bold: true, color: { argb: 'FF000000' } };
    headerRow.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    filteredLogs.forEach((log) => {
      const row = worksheet.addRow([
        formatDisplayDate(log.log_date),
        log.driver_name,
        log.job_number,
        log.task_letter || "—",
        log.paperwork === 1 ? "YES" : "—",
        log.location || "—",
        log.start_time || "—",
        log.stop_time || "—",
        log.total_time || "—",
        "",
        log.arrival_back_time || "—"
      ]);

      if (log.signature && log.signature.startsWith('data:image')) {
        try {
          const imageId = workbook.addImage({
            base64: log.signature,
            extension: 'png',
          });
          worksheet.addImage(imageId, {
            tl: { col: 9, row: row.number - 1 },
            ext: { width: 90, height: 30 }
          });
          row.height = 35;
        } catch (err) {
          console.error("Error embedding signature in Excel:", err);
        }
      }
    });

    worksheet.addRow([]);
    const footerRow = worksheet.addRow(["", "Driver Signature:", "", "", "", "", "", "", "Total Drive Time:", totalDriveTime]);
    footerRow.font = { bold: true };
    worksheet.getCell(`I${footerRow.number}`).alignment = { horizontal: 'right' };

    for (let i = 1; i <= 11; i++) {
      const column = worksheet.getColumn(i);
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 12 ? 12 : maxLength + 2;
    }

    worksheet.getColumn(2).width = Math.max(worksheet.getColumn(2).width || 0, 18);
    worksheet.getColumn(9).width = Math.max(worksheet.getColumn(9).width || 0, 18);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Driver_Delivery_Time_Log_${driverNameForFile}_${startDate}_to_${endDate}.xlsx`;
    anchor.click();
    
    window.URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = "Driver Delivery Time Log";
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    const headers = [
      [
        "Date", "Driver", "Job Number", "Task Letter", "Paperwork", 
        "Pick Up / Delivery Location", "Start Time", "Stop Time", "Total Time", "Signature", "Arrival Time Back at Building",
      ],
    ];

    const data = filteredLogs.map((log) => [
      formatDisplayDate(log.log_date),
      log.driver_name,
      log.job_number,
      log.task_letter || "—",
      log.paperwork === 1 ? "YES" : "—",
      log.location || "—",
      log.start_time || "—",
      log.stop_time || "—",
      log.total_time || "—",
      "",
      log.arrival_back_time || "—",
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 60,
      theme: "grid",
      headStyles: { fillColor: [124, 92, 252], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 6, valign: "middle" as const, halign: "left" as const, overflow: "linebreak", cellWidth: "wrap" },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
        3: { cellWidth: 64 },
        4: { cellWidth: 60 },
        5: { cellWidth: 140 },
        6: { cellWidth: 56 },
        7: { cellWidth: 56 },
        8: { cellWidth: 56 },
        9: { cellWidth: 70, minCellHeight: 25 },
        10: { cellWidth: 90 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 9) {
          const log = filteredLogs[data.row.index];
          if (log && log.signature && log.signature.startsWith('data:image')) {
            try {
              doc.addImage(
                log.signature,
                'PNG',
                data.cell.x + 3,
                data.cell.y + 2,
                data.cell.width - 6,
                data.cell.height - 4
              );
            } catch (err) {}
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const labelY = finalY + 40;

    doc.setFontSize(10);
    const signatureLabel = "Driver Signature:";
    const signatureLabelWidth = doc.getTextWidth(signatureLabel);
    const signatureLineStart = margin + signatureLabelWidth + 10;
    const signatureLineEnd = Math.min(pageWidth - margin - 200, signatureLineStart + 100);
    doc.text(signatureLabel, margin, labelY);
    doc.line(signatureLineStart, labelY + 3, signatureLineEnd, labelY + 3);

    const totalDriveMinutes = filteredLogs.reduce((sum, log) => {
      const match = log.total_time ? log.total_time.match(/(\d+)h\s*(\d+)m/) : null;
      if (!match) return sum;
      return sum + Number(match[1]) * 60 + Number(match[2]);
    }, 0);

    const totalDriveTime = totalDriveMinutes ? `${Math.floor(totalDriveMinutes / 60)}h ${totalDriveMinutes % 60}m` : "—";
    const totalText = `Total Drive Time: ${totalDriveTime}`;
    const totalX = pageWidth - margin - doc.getTextWidth(totalText);
    doc.text(totalText, totalX, labelY);

    const driverNameForFile = selectedDriver === "All Drivers" ? "all" : selectedDriver.replace(/\s+/g, "_");
    doc.save(`Driver_Delivery_Time_Log_${driverNameForFile}_${startDate}_to_${endDate}.pdf`);
  };

  // Helper to load image as Base64 for jsPDF
  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = url;
    });
  };

  // Export Delivery Requests to PDF matching exact form layout cleanly
  const exportRequestsToPdf = async () => {
    if (filteredRequests.length === 0) {
      toast.error("No delivery requests to export.");
      return;
    }

    const logoBase64 = await loadImageAsBase64("/TGI-logo.png");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    
    filteredRequests.forEach((req, idx) => {
      if (idx > 0) doc.addPage();

      const deliverTo = typeof req.deliverTo === 'string' ? JSON.parse(req.deliverTo || '{}') : (req.deliverTo || {});
      const workFor = typeof req.workFor === 'string' ? JSON.parse(req.workFor || '{}') : (req.workFor || {});
      const internalUse = typeof req.internal_use === 'string' ? JSON.parse(req.internal_use || '{}') : (req.internalUse || req.internal_use || {});

      const margin = 35;
      let y = 35;

      // Outer border box matching form container cleanly within A4 height
      doc.setLineWidth(0.8);
      doc.setDrawColor(80, 80, 80);
      doc.rect(margin, y, 525, 760);

      // --- HEADER SECTION ---
      y += 12;
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", margin + 12, y, 90, 32);
        } catch (e) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.text("tgi direct", margin + 12, y + 15);
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("tgi direct", margin + 12, y + 15);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Marketing Support Services", margin + 12, y + 44);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("P.O. Box, Flint, MI 48507-0354", margin + 12, y + 54);
      doc.text("(800) 337-2237 Fax (810) 239-4321", margin + 12, y + 63);
      doc.text("www.tgidirect.com", margin + 12, y + 72);

      // Delivery Request Table (Top Right)
      const tableX = 335;
      const tableY = y + 5;
      doc.setDrawColor(0, 0, 0);
      doc.rect(tableX, tableY, 205, 48);
      
      doc.setFillColor(230, 230, 230);
      doc.rect(tableX, tableY, 205, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Delivery Request", tableX + 102.5, tableY + 11, { align: "center" });

      // Columns: Job, Task, Description, Date
      doc.line(tableX, tableY + 15, tableX + 205, tableY + 15);
      doc.line(tableX + 45, tableY + 15, tableX + 45, tableY + 48);
      doc.line(tableX + 80, tableY + 15, tableX + 80, tableY + 48);
      doc.line(tableX + 140, tableY + 15, tableX + 140, tableY + 48);

      doc.setFontSize(7.5);
      doc.text("Job", tableX + 22.5, tableY + 24, { align: "center" });
      doc.text("Task", tableX + 62.5, tableY + 24, { align: "center" });
      doc.text("Description", tableX + 110, tableY + 24, { align: "center" });
      doc.text("Date", tableX + 172.5, tableY + 24, { align: "center" });

      doc.line(tableX, tableY + 30, tableX + 205, tableY + 30);
      doc.setFont("helvetica", "normal");
      doc.text(req.job_number || "—", tableX + 22.5, tableY + 40, { align: "center" });
      doc.text(req.task || "—", tableX + 62.5, tableY + 40, { align: "center" });
      doc.text(req.description || "—", tableX + 110, tableY + 40, { align: "center" });
      doc.text(req.date ? formatDisplayDate(req.date) : "—", tableX + 172.5, tableY + 40, { align: "center" });

      // Horizontal Divider under header
      y += 88;
      doc.line(margin, y, margin + 525, y);

      // --- DELIVER TO & WORK FOR BOXES ---
      y += 12;
      const boxWidth = 250;
      const boxHeight = 82;

      // Deliver To Box
      doc.rect(margin + 12, y, boxWidth, boxHeight);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin + 12, y, boxWidth, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Deliver To:", margin + 18, y + 11);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(deliverTo.name || "—", margin + 18, y + 27);
      doc.text(deliverTo.company || "—", margin + 18, y + 40);
      doc.text(deliverTo.address1 || "—", margin + 18, y + 53);
      doc.text(deliverTo.address2 || "", margin + 18, y + 66);

      // Work For Box
      doc.rect(margin + 267, y, boxWidth, boxHeight);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin + 267, y, boxWidth, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Work For:", margin + 273, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(workFor.company || "—", margin + 273, y + 32);
      doc.text(workFor.address1 || "—", margin + 273, y + 48);
      doc.text(workFor.address2 || "", margin + 273, y + 64);

      // --- INSTRUCTIONS BOX ---
      y += 94;
      doc.rect(margin + 12, y, 505, 30);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin + 12, y, 505, 14, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Instructions:", margin + 18, y + 10.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(req.instructions || "—", margin + 18, y + 23);

      // --- DETAILS BOX ---
      y += 38;
      doc.rect(margin + 12, y, 505, 115);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin + 12, y, 505, 14, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Details:", margin + 18, y + 10.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(req.details || "—", margin + 18, y + 25, { maxWidth: 485 });

      // --- RECEIVED BY & SIGNATURE BOX ---
      y += 123;
      // Increased box height from 88 to 108 to fit the email field
      doc.rect(margin + 12, y, 505, 108); 
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Received By:", margin + 18, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(req.received_by_name || "—", margin + 85, y + 18);
      doc.line(margin + 80, y + 21, margin + 270, y + 21);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", margin + 300, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(req.receive_date ? formatDisplayDate(req.receive_date) : "—", margin + 335, y + 18);
      doc.line(margin + 330, y + 21, margin + 470, y + 21);

      // Add the Client Email row
      doc.setFont("helvetica", "bold");
      doc.text("Client Email:", margin + 18, y + 36);
      doc.setFont("helvetica", "normal");
      // Check for both camelCase and snake_case depending on API response
      doc.text(req.clientEmail || req.client_email || "—", margin + 85, y + 36); 
      doc.line(margin + 80, y + 39, margin + 270, y + 39);

      // Shifted signature text and image down to row 3
      doc.setFont("helvetica", "bold");
      doc.text("Client Signature:", margin + 18, y + 56);
      if (req.client_signature && req.client_signature.startsWith('data:image')) {
        try {
          doc.addImage(req.client_signature, 'PNG', margin + 110, y + 44, 150, 52);
        } catch (e) {}
      }

      // --- TGI INTERNAL USE BOX ---
      // Shifted down from 96 to 116 to account for the taller box above
      y += 116; 
      doc.rect(margin + 12, y, 505, 58);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin + 12, y, 505, 15, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("TGI Internal Use:", margin + 18, y + 11);

      doc.line(margin + 12, y + 15, margin + 517, y + 15);
      doc.line(margin + 180, y + 15, margin + 180, y + 36);
      doc.line(margin + 350, y + 15, margin + 350, y + 36);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Driver: ${internalUse.driver || "—"}`, margin + 18, y + 26);
      doc.text(`Vehicle: ${internalUse.vehicle || "—"}`, margin + 195, y + 26);
      doc.text(`Zone: ${internalUse.zone || "—"}`, margin + 365, y + 26);

      doc.line(margin + 12, y + 36, margin + 517, y + 36);
      doc.line(margin + 130, y + 36, margin + 130, y + 58);
      doc.line(margin + 240, y + 36, margin + 240, y + 58);
      doc.line(margin + 350, y + 36, margin + 350, y + 58);

      doc.text(`Bill: ${internalUse.bill || "—"}`, margin + 18, y + 48);
      doc.text(`Hrs: ${internalUse.hrs || "—"}`, margin + 142, y + 48);
      doc.text(`Min: ${internalUse.min || "—"}`, margin + 252, y + 48);
      doc.text(`By: ${internalUse.by || "—"}`, margin + 365, y + 48);

      // Page Number Footer (Nicely padded inside bottom border)
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.text("Page 1 of 1", margin + 500, 788, { align: "right" });
    });

    doc.save(`Delivery_Requests_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* HEADER & TAB NAVIGATION */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
            {isOfflineLoaded && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md">
                <WifiOff size={12} /> Viewing cached records offline
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* TAB SWITCHER */}
            <div className="flex bg-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "logs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Driver Delivery Logs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "requests" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardCheck size={14} /> Delivery Requests & Sign-offs ({deliveryRequests.length})
              </button>
            </div>

            {activeTab === "logs" && (
              <>
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <FileSpreadsheet size={15} /> Excel
                </button>
                <button
                  type="button"
                  onClick={exportToPdf}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <FileText size={15} /> PDF
                </button>
              </>
            )}

            {activeTab === "requests" && (
              <button
                type="button"
                onClick={exportRequestsToPdf}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition-all"
              >
                <Download size={15} /> Export Requests to PDF
              </button>
            )}
          </div>
        </div>

        {/* SEARCH AND FILTERS (Active for both tabs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase">Search</span>
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="text" 
              placeholder={activeTab === "logs" ? "Driver or Job #..." : "Job #, Recipient, Instructions..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase">Start Date</span>
            <CalendarDays size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase">End Date</span>
            <CalendarDays size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase">Driver</span>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-medium truncate"
            >
              <option value="All Drivers">All Drivers</option>
              {uniqueDrivers.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB CONTENT: DRIVER LOGS TABLE */}
        {activeTab === "logs" && (
          <div className="bg-white border border-slate-300 rounded-xl shadow-md overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-slate-500 text-sm font-semibold">
                <Loader size={16} className="animate-spin text-primary" /> Loading active data rows...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm font-medium italic">
                No registered delivery logs found matching the filter parameters.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400">
                    <th className="px-3 py-3 text-xs font-bold uppercase text-slate-700 text-center w-24 border-r border-slate-300">Details</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 w-28">Date</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300">Driver</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 font-mono w-28">Job Number</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 text-center w-24">Task Code</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 text-center w-24">Paperwork</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300">Pick Up / Delivery Location</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 font-mono text-center w-24">Start Time</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 font-mono text-center w-24">Stop Time</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 font-mono text-center bg-violet-50/50 w-24">Total Time</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 border-r border-slate-300 text-center w-36">Signature</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-700 font-mono text-center w-48">Arrival Time Back at Building</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogForDetails(log)}
                      className={`border-b border-slate-300 transition-colors cursor-pointer hover:bg-violet-50/50 ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                    >
                      <td className="px-3 py-3 text-center border-r border-slate-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetails(log);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 border-r border-slate-200">{formatDisplayDate(log.log_date)}</td>
                      <td className="px-4 py-3 text-sm font-extrabold text-slate-900 border-r border-slate-200">{log.driver_name}</td>
                      <td className="px-4 py-3 text-sm font-bold font-mono text-primary border-r border-slate-200">{log.job_number}</td>
                      <td className="px-3 py-3 text-sm font-extrabold font-mono text-center text-slate-800 border-r border-slate-200">{log.task_letter || "—"}</td>
                      <td className="px-3 py-3 text-sm font-bold text-center border-r border-slate-200">
                        {log.paperwork === 1 ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">YES</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 border-r border-slate-200 truncate max-w-xs">{log.location || "—"}</td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-600 border-r border-slate-200">{log.start_time || "—"}</td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-600 border-r border-slate-200">{log.stop_time || "—"}</td>
                      <td className="px-4 py-3 text-sm font-extrabold font-mono text-center text-primary border-r border-slate-200 bg-violet-50/20">{log.total_time || "—"}</td>
                      <td className="px-4 py-3 text-center border-r border-slate-200">
                        {log.signature ? (
                          <img src={log.signature} alt="Driver Signature" className="h-8 max-w-[110px] object-contain mx-auto bg-white border border-slate-200 rounded p-0.5" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-800">{log.arrival_back_time || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB CONTENT: DELIVERY REQUESTS & SIGN-OFFS */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {loadingRequests ? (
              <div className="flex items-center justify-center py-20 gap-2 text-slate-500 text-sm font-semibold">
                <Loader size={16} className="animate-spin text-primary" /> Loading delivery requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm font-medium italic">
                No signed delivery requests matching the filter parameters.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const deliverTo = typeof req.deliverTo === 'string' ? JSON.parse(req.deliverTo || '{}') : (req.deliverTo || {});
                const workFor = typeof req.workFor === 'string' ? JSON.parse(req.workFor || '{}') : (req.workFor || {});
                const internalUse = typeof req.internal_use === 'string' ? JSON.parse(req.internal_use || '{}') : (req.internalUse || req.internal_use || {});

                return (
                  <div key={req.id} className="max-w-3xl mx-auto p-4 sm:p-6 bg-white border border-gray-400 shadow-sm my-6 font-sans text-xs text-black">
                    
                    {/* HEADER SECTION: Logo & Delivery Request Table */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-black pb-4">
                      <div>
                        <img src="/TGI-logo.png" alt="TGI Direct Logo" className="h-14 sm:h-16 object-contain mb-1" />
                        <div className="font-bold text-sm tracking-wide">Marketing Support Services</div>
                        <div className="text-[10px] text-gray-700 leading-tight">
                          P.O. Box, Flint, MI 48507-0354<br />
                          (800) 337-2237 Fax (810) 239-4321<br />
                          www.tgidirect.com
                        </div>
                      </div>

                      <div className="border border-black w-full sm:w-80 text-center">
                        <div className="bg-gray-200 border-b border-black font-bold py-1 text-xs">Delivery Request</div>
                        <div className="grid grid-cols-4 divide-x divide-black border-b border-black text-[10px] sm:text-[11px]">
                          <div className="py-1 px-0.5 font-semibold">Job</div>
                          <div className="py-1 px-0.5 font-semibold">Task</div>
                          <div className="py-1 px-0.5 font-semibold">Description</div>
                          <div className="py-1 px-0.5 font-semibold">Date</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-black h-8 items-center text-[10px] sm:text-[11px]">
                          <div className="py-1 px-0.5 font-medium truncate">{req.job_number || "—"}</div>
                          <div className="py-1 px-0.5 font-medium truncate">{req.task || "—"}</div>
                          <div className="py-1 px-0.5 font-medium truncate">{req.description || "—"}</div>
                          <div className="py-1 px-0.5 font-medium truncate">{req.date ? formatDisplayDate(req.date) : "—"}</div>
                        </div>
                      </div>
                    </div>

                    {/* DELIVER TO & WORK FOR BOXES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="border border-black">
                        <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Deliver To:</div>
                        <div className="p-2 space-y-1">
                          <div className="border-b border-dashed border-gray-400 p-0.5">{deliverTo.name || "—"}</div>
                          <div className="border-b border-dashed border-gray-400 p-0.5">{deliverTo.company || "—"}</div>
                          <div className="border-b border-dashed border-gray-400 p-0.5">{deliverTo.address1 || "—"}</div>
                          <div className="p-0.5">{deliverTo.address2 || ""}</div>
                        </div>
                      </div>

                      <div className="border border-black">
                        <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Work For:</div>
                        <div className="p-2 space-y-1">
                          <div className="border-b border-dashed border-gray-400 p-0.5">{workFor.company || "—"}</div>
                          <div className="border-b border-dashed border-gray-400 p-0.5">{workFor.address1 || "—"}</div>
                          <div className="p-0.5">{workFor.address2 || ""}</div>
                        </div>
                      </div>
                    </div>

                    {/* INSTRUCTIONS */}
                    <div className="border border-black mt-4">
                      <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Instructions:</div>
                      <div className="p-2 font-medium">{req.instructions || "—"}</div>
                    </div>

                    {/* DETAILS SECTION */}
                    <div className="border border-black mt-4">
                      <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Details:</div>
                      <div className="p-2 min-h-[120px] whitespace-pre-line">{req.details || "—"}</div>
                    </div>

                    {/* RECEIVED BY & SIGNATURE */}
                    <div className="border border-black p-3 space-y-3 mt-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2 w-full sm:w-1/2">
                          <span className="font-bold whitespace-nowrap">Received By:</span>
                          <span className="border-b border-black flex-1 px-1">{req.received_by_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-1/3">
                          <span className="font-bold whitespace-nowrap">Date:</span>
                          <span className="border-b border-black flex-1 px-1">{req.receive_date ? formatDisplayDate(req.receive_date) : "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full">
                        <span className="font-bold whitespace-nowrap">Client Email:</span>
                        <span className="border-b border-black flex-1 px-1">{req.clientEmail || "—"}</span>
                      </div>

                      <div className="pt-2">
                        <div className="font-bold mb-1">Client Signature:</div>
                        <div className="border border-dashed border-gray-500 bg-gray-50 p-1 inline-block w-full sm:w-auto">
                          {req.client_signature ? (
                            <img src={req.client_signature} alt="Client Signature" className="h-16 w-full sm:w-64 object-contain bg-white border border-gray-300" />
                          ) : (
                            <span className="text-gray-400 italic">No signature provided</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* TGI INTERNAL USE */}
                    <div className="border border-black mt-4">
                      <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">TGI Internal Use:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-black divide-y sm:divide-y-0 sm:divide-x divide-black text-[11px]">
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Driver:</span>
                          <span>{internalUse.driver || "—"}</span>
                        </div>
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Vehicle:</span>
                          <span>{internalUse.vehicle || "—"}</span>
                        </div>
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Zone:</span>
                          <span>{internalUse.zone || "—"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-black text-[11px]">
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Bill:</span>
                          <span>{internalUse.bill || "—"}</span>
                        </div>
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Hrs:</span>
                          <span>{internalUse.hrs || "—"}</span>
                        </div>
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">Min:</span>
                          <span>{internalUse.min || "—"}</span>
                        </div>
                        <div className="p-1 flex items-center gap-1">
                          <span className="font-semibold">By:</span>
                          <span>{internalUse.by || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-500 italic text-[11px] mt-2 text-right">Page 1 of 1</div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      <LogDetailsModal
        log={selectedLogForDetails}
        isOpen={!!selectedLogForDetails}
        onClose={() => setSelectedLogForDetails(null)}
      />

      <ConfirmModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={confirmDeleteLog}
        title="Delete Delivery Log Record?"
        description={`Are you sure you want to delete log #${logToDelete?.id} for ${logToDelete?.driver_name} (Job #${logToDelete?.job_number})? This action cannot be undone.`}
        confirmText="Delete Record"
        cancelText="Cancel"
        variant="destructive"
        icon={<Trash2 size={20} />}
      />
    </div>
  );
}