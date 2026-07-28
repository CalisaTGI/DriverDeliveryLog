import { useState, useEffect } from "react";
import { FileSpreadsheet, FileText, Loader, Search, CalendarDays } from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface DatabaseLog {
  id: number;
  log_date: string;
  driver_name: string;
  job_number: string;
  task_letter: string;
  paperwork: number;
  location: string;
  start_time: string;
  stop_time: string;
  total_time: string;
  arrival_back_time: string;
}

export default function BillingDashboard() {
  const [logs, setLogs] = useState<DatabaseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("All Drivers");

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

  // Fetch from the backend whenever the dates change
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:5000/api/billing-export?start=${startDate}&end=${endDate}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to read log tables:", err);
        setLoading(false);
      });
  }, [startDate, endDate]);

  const exportToExcel = async () => {
    const totalDriveMinutes = filteredLogs.reduce((sum, log) => {
      const match = log.total_time.match(/(\d+)h\s*(\d+)m/);
      if (!match) return sum;
      return sum + Number(match[1]) * 60 + Number(match[2]);
    }, 0);

    const totalDriveTime = totalDriveMinutes ? `${Math.floor(totalDriveMinutes / 60)}h ${totalDriveMinutes % 60}m` : "—";
    const driverNameForFile = selectedDriver === "All Drivers" ? "all" : selectedDriver.replace(/\s+/g, "_");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Delivery Logs');

    // 1. Add Title Row and Merge Cells
    const titleRow = worksheet.addRow(['Driver Delivery Time Log']);
    worksheet.mergeCells('A1:J1');
    
    // 🎨 STYLE: Large, bold, white text with a purple background
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C5CFC' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 2. Add Header Row
    const headers = [
      "Date", "Driver", "Job Number", "Task Code", "Paperwork", 
      "Pick Up / Delivery Location", "Start Time", "Stop Time", "Total Time", "Arrival Time Back at Building"
    ];
    const headerRow = worksheet.addRow(headers);
    
    // 🎨 STYLE: Bold text with a light gray background for headers
    headerRow.font = { bold: true, color: { argb: 'FF000000' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 3. Add the Data
    filteredLogs.forEach((log) => {
      worksheet.addRow([
        formatDisplayDate(log.log_date),
        log.driver_name,
        log.job_number,
        log.task_letter || "—",
        log.paperwork === 1 ? "YES" : "—",
        log.location || "—",
        log.start_time || "—",
        log.stop_time || "—",
        log.total_time || "—",
        log.arrival_back_time || "—"
      ]);
    });

    // 4. Add the Footer
    worksheet.addRow([]); // Blank row
    const footerRow = worksheet.addRow(["", "Driver Signature:", "", "", "", "", "", "", "Total Drive Time:", totalDriveTime]);
    
    // 🎨 STYLE: Bold the footer row
    footerRow.font = { bold: true };
    worksheet.getCell(`I${footerRow.number}`).alignment = { horizontal: 'right' };

    // 5. AUTO-FIT COLUMNS LOGIC (TypeScript Safe)
    for (let i = 1; i <= 10; i++) {
      const column = worksheet.getColumn(i);
      let maxLength = 0;
      
      // The optional chaining (?.) prevents TS from panicking
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      
      column.width = maxLength < 12 ? 12 : maxLength + 2;
    }

    // Ensure footer isn't squished
    worksheet.getColumn(2).width = Math.max(worksheet.getColumn(2).width || 0, 18); // Driver Signature
    worksheet.getColumn(9).width = Math.max(worksheet.getColumn(9).width || 0, 18); // Total Drive Time

    // 6. Generate the file buffer and trigger download in the browser natively
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
        "Date",
        "Driver",
        "Job Number",
        "Task Letter",
        "Paperwork",
        "Pick Up / Delivery Location",
        "Start Time",
        "Stop Time",
        "Total Time",
        "Arrival Time Back at Building",
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
        9: { cellWidth: 120 },
      },
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
      const match = log.total_time.match(/(\d+)h\s*(\d+)m/);
      if (!match) return sum;
      return sum + Number(match[1]) * 60 + Number(match[2]);
    }, 0);

    const totalDriveTime = totalDriveMinutes ? `${Math.floor(totalDriveMinutes / 60)}h ${totalDriveMinutes % 60}m` : "—";
    const totalText = `Total Drive Time: ${totalDriveTime}`;
    const totalX = pageWidth - margin - doc.getTextWidth(totalText);
    doc.text(totalText, totalX, labelY);

    const driverNameForFile = selectedDriver === "All Drivers" ? "all" : selectedDriver.replace(/\s+/g, "_");
    // Updated filename to reflect date range
    doc.save(`Driver_Delivery_Time_Log_${driverNameForFile}_${startDate}_to_${endDate}.pdf`);
  };

  const isIncompleteLog = (log: DatabaseLog) => {
    const hasJobNumber = !!log.job_number?.trim();
    const hasCompleteTime = !!log.start_time?.trim() && !!log.stop_time?.trim() && !!log.total_time?.trim();
    return !hasJobNumber || !hasCompleteTime;
  };

  const visibleLogs = logs.filter((log) => !isIncompleteLog(log));
  const uniqueDrivers = Array.from(new Set(visibleLogs.map((log) => log.driver_name))).sort();

  const filteredLogs = visibleLogs.filter((log) => {
    const matchesDriver = selectedDriver === "All Drivers" ? true : log.driver_name === selectedDriver;
    const matchesSearch =
      log.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.job_number.includes(searchTerm);
    
    // The backend is handling the date filtering now, so we only apply client-side text/driver filtering
    return matchesDriver && matchesSearch;
  });

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Driver Delivery Time Log</h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={exportToExcel}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.99] w-full sm:w-auto"
            >
              <FileSpreadsheet size={16} />
              Export to Excel
            </button>
            <button
              type="button"
              onClick={exportToPdf}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.99] w-full sm:w-auto"
            >
              <FileText size={16} />
              Export to PDF
            </button>
          </div>
        </div>

        {/* Updated Grid layout to accommodate 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary/40 transition-all relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase tracking-wider">Search</span>
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Driver or Job #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-400/80 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary/40 transition-all relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase tracking-wider">Start Date</span>
            <CalendarDays size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-mono [color-scheme:light]"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary/40 transition-all relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase tracking-wider">End Date</span>
            <CalendarDays size={15} className="text-slate-400 flex-shrink-0" />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none font-mono [color-scheme:light]"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary/40 transition-all relative">
            <span className="text-[9px] font-bold text-slate-400 absolute -top-2 bg-white px-1 left-3 uppercase tracking-wider">Driver</span>
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
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-sans w-28">Date</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-sans">Driver</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-mono w-28">Job Number</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-mono text-center w-24">Task Code</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-sans text-center w-24">Paperwork</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-sans">Pick Up / Delivery Location</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-mono text-center w-24">Start Time</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-mono text-center w-24">Stop Time</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300 font-mono text-center bg-violet-50/50 w-24">Total Time</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono text-center w-48">Arrival Time Back at Building</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => (
                  <tr key={log.id} className={`border-b border-slate-300 transition-colors hover:bg-slate-50 ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}>
                    <td className="px-4 py-3 text-xs font-bold font-sans text-slate-600 border-r border-slate-200">{formatDisplayDate(log.log_date)}</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-slate-900 border-r border-slate-200">{log.driver_name}</td>
                    <td className="px-4 py-3 text-sm font-bold font-mono text-primary border-r border-slate-200">{log.job_number}</td>
                    <td className="px-3 py-3 text-sm font-extrabold font-mono text-center text-slate-800 border-r border-slate-200">{log.task_letter || "—"}</td>
                    <td className="px-3 py-3 text-sm font-bold text-center border-r border-slate-200">
                      {log.paperwork === 1 ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">YES</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 border-r border-slate-200 truncate max-w-xs">{log.location || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-600 border-r border-slate-200">{log.start_time || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-600 border-r border-slate-200">{log.stop_time || "—"}</td>
                    <td className="px-4 py-3 text-sm font-extrabold font-mono text-center text-primary border-r border-slate-200 bg-violet-50/20">{log.total_time || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold font-mono text-center text-slate-800">{log.arrival_back_time || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}