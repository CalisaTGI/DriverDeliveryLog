import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getApiUrl } from '../lib/apiConfig';
import { toast } from "sonner";

// Helper to reliably get today's date in local time format (YYYY-MM-DD)
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface AddressBlock {
  name?: string;
  company: string;
  address1: string;
  address2?: string;
}

interface InternalUseBlock {
  driver: string;
  vehicle: string;
  zone: string;
  bill: string;
  hrs: string;
  min: string;
  by: string;
}

interface DeliveryFormState {
  job: string;
  task: string;
  description: string;
  date: string;
  deliverTo: AddressBlock;
  workFor: AddressBlock;
  instructions: string;
  details: string;
  receivedByName: string;
  receiveDate: string;
  clientSignature: string;
  internalUse: InternalUseBlock;
  clientEmail: string;
}

export default function DeliveryRequestForm() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [formData, setFormData] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const passedDate = params.get('date');
    const passedDriver = params.get('driver');
    const passedHrs = params.get('hrs');
    const passedMin = params.get('min');
    const jobParam = params.get('job');

    // Check if a saved delivery request already exists in localStorage for this job
    if (jobParam) {
      const existingSaved = localStorage.getItem(`delivery_request_${jobParam}`);
      if (existingSaved) {
        try {
          return JSON.parse(existingSaved);
        } catch (e) {}
      }
    }

    return {
      job: jobParam || '',
      task: params.get('task') || '',
      description: '',
      date: passedDate || getTodayDate(), 
      deliverTo: { name: '', company: '', address1: '', address2: '' },
      workFor: { company: '', address1: '', address2: '' },
      instructions: '',
      details: '',
      receivedByName: '',
      receiveDate: passedDate || getTodayDate(), 
      clientSignature: '',
      internalUse: { 
        driver: passedDriver || '', 
        vehicle: '', 
        zone: '', 
        bill: '', 
        hrs: passedHrs || '',
        min: passedMin || '',
        by: '' 
      },
      clientEmail: ''
    };
  });

  // Background sync for offline requests when connection returns
  useEffect(() => {
    const handleOnlineSync = async () => {
      const queue = JSON.parse(localStorage.getItem('offline_delivery_requests_queue') || "[]");
      if (queue.length === 0) return;

      toast.info("Connection restored. Syncing offline delivery requests...");

      const remainingQueue = [];
      for (const req of queue) {
        try {
          const res = await fetch(getApiUrl('/api/delivery-requests'), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
          });
          if (!res.ok) remainingQueue.push(req);
        } catch (e) {
          remainingQueue.push(req);
        }
      }

      localStorage.setItem('offline_delivery_requests_queue', JSON.stringify(remainingQueue));
      if (remainingQueue.length === 0) {
        toast.success("All offline delivery requests successfully synced!");
      }
    };

    window.addEventListener('online', handleOnlineSync);
    return () => window.removeEventListener('online', handleOnlineSync);
  }, []);

  // Redraw client signature onto canvas if it exists in state
  useEffect(() => {
    if (formData.clientSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = formData.clientSignature;
      }
    }
  }, [formData.clientSignature]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, 
    section?: 'deliverTo' | 'workFor' | 'internalUse', 
    field?: string
  ) => {
    if (section && field) {
      setFormData((prev: DeliveryFormState) => ({
        ...prev,
        [section]: { ...prev[section], [field]: e.target.value }
      }));
    } else {
      setFormData((prev: DeliveryFormState) => ({ ...prev, [e.target.name]: e.target.value }));
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Scale coordinates between internal canvas resolution and screen display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFormData((prev: DeliveryFormState) => ({ ...prev, clientSignature: canvas.toDataURL() }));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData((prev: DeliveryFormState) => ({ ...prev, clientSignature: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.job) {
      alert('Please enter a Job number.');
      return;
    }

    // 1. Detect if the canvas is completely blank
    let signatureData = formData.clientSignature;
    const canvas = canvasRef.current;
    if (canvas) {
      const blankCanvas = document.createElement('canvas');
      blankCanvas.width = canvas.width;
      blankCanvas.height = canvas.height;
      
      if (canvas.toDataURL() === blankCanvas.toDataURL()) {
        signatureData = '';
      } else {
        signatureData = canvas.toDataURL();
      }
    }

    const payload = {
      ...formData,
      jobNumber: formData.job,
      clientSignature: signatureData,
      clientEmail: formData.clientEmail,
    };

    try {
      if (!navigator.onLine) {
        throw new Error("Offline mode active");
      }

      const response = await fetch(getApiUrl('/api/delivery-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save delivery request.');

      toast.success('Delivery request successfully saved!');

    } catch (err: any) {
      console.warn("Network request failed, saving to offline queue:", err);

      try {
        const offlineQueue = JSON.parse(localStorage.getItem('offline_delivery_requests_queue') || '[]');
        offlineQueue.push({ ...payload, queued_at: new Date().toISOString() });
        localStorage.setItem('offline_delivery_requests_queue', JSON.stringify(offlineQueue));

        toast.warning('You are offline. Delivery request saved locally and will sync automatically when reconnected.');
      } catch (storageErr) {
        console.error("Failed to save offline queue:", storageErr);
        alert(`Error: ${err.message}`);
        return;
      }
    }

    // 2. Check if the user actually filled out any form data before locking the job
    const hasFilledData = 
      Boolean(signatureData && signatureData.trim() !== '') ||
      Boolean(formData.deliverTo?.name?.trim()) ||
      Boolean(formData.deliverTo?.company?.trim()) ||
      Boolean(formData.deliverTo?.address1?.trim()) ||
      Boolean(formData.workFor?.company?.trim()) ||
      Boolean(formData.instructions?.trim()) ||
      Boolean(formData.details?.trim()) ||
      Boolean(formData.receivedByName?.trim()) ||
      Boolean(formData.clientEmail?.trim());

    // Only lock the job if actual data was provided
    if (hasFilledData) {
      const lockedJobs = JSON.parse(localStorage.getItem('locked_delivery_jobs') || '[]');
      if (formData.job && !lockedJobs.includes(formData.job)) {
        lockedJobs.push(formData.job);
        localStorage.setItem('locked_delivery_jobs', JSON.stringify(lockedJobs));
      }
    }

    // 3. Save to localStorage
    localStorage.setItem(`delivery_request_${formData.job}`, JSON.stringify({
      ...formData,
      clientSignature: signatureData
    }));

    setFormData({
      job: '',
      task: '',
      description: '',
      date: getTodayDate(),
      deliverTo: { name: '', company: '', address1: '', address2: '' },
      workFor: { company: '', address1: '', address2: '' },
      instructions: '',
      details: '',
      receivedByName: '',
      receiveDate: getTodayDate(),
      clientSignature: '',
      internalUse: { driver: '', vehicle: '', zone: '', bill: '', hrs: '', min: '', by: '' },
      clientEmail: ''
    });
    
    clearSignature();
    navigate(-1);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-6 bg-white border-y sm:border border-gray-400 shadow-sm sm:my-6 font-sans text-xs text-black">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* HEADER SECTION */}
        <div className="flex flex-row justify-between items-center gap-2 border-b-2 border-black pb-3">
          <div className="flex-shrink-0 max-w-[125px] sm:max-w-none">
            <img src="/TGI-logo.png" alt="TGI Direct Logo" className="h-10 sm:h-12 object-contain mb-1" />
            <div className="font-bold text-[10px] sm:text-sm leading-tight">Marketing Support Services</div>
            <div className="text-[7.5px] sm:text-[10px] text-gray-700 leading-tight">
              P.O. Box, Flint, MI 48507-0354<br />
              (800) 337-2237 Fax (810) 239-4321<br />
              www.tgidirect.com
            </div>
          </div>

          <div className="border border-black w-[190px] sm:w-60 text-center flex-shrink-0">
            <div className="bg-gray-200 border-b border-black font-bold py-0.5 text-[9px] sm:text-xs">
              Delivery Request
            </div>
            <div className="grid grid-cols-[60px_20px_45px_65px] sm:grid-cols-[65px_35px_50px_65px] divide-x divide-black border-b border-black text-[6px] sm:text-[11px]">
              <div className="py-0.5 px-0.5 font-semibold min-w-0 text-center">Job</div>
              <div className="py-0.5 px-0.5 font-semibold min-w-0 text-center">Task</div>
              <div className="py-0.5 px-0.5 font-semibold min-w-0 text-center">Desc.</div>
              <div className="py-0.5 px-0.5 font-semibold min-w-0 text-center">Date</div>
            </div>
            <div className="grid grid-cols-[60px_20px_45px_65px] sm:grid-cols-[65px_35px_50px_65px] divide-x divide-black border-b border-black text-[6px] sm:text-[11px]">
              <input
                type="text"
                name="job"
                value={formData.job}
                onChange={handleChange}
                placeholder="268347"
                className="w-full min-w-0 text-center focus:outline-none bg-transparent px-0"
                required
              />
              <input
                type="text"
                name="task"
                value={formData.task}
                onChange={handleChange}
                placeholder="A"
                className="w-full min-w-0 text-center focus:outline-none bg-transparent px-0"
              />
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="06.26"
                className="w-full min-w-0 text-center focus:outline-none bg-transparent px-0"
              />
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full min-w-0 text-center focus:outline-none bg-transparent px-0 text-[7px] sm:text-[10px] appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:justify-center"
              />
            </div>
          </div>
        </div>

        {/* DELIVER TO & WORK FOR BOXES */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="border border-black flex flex-col w-full md:w-1/2">
            <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Deliver To:</div>
            <div className="p-2 space-y-1 flex-1 flex flex-col justify-between">
              {/* <input 
                type="text" 
                placeholder="Recipient Name (e.g. Gary Coulier)" 
                value={formData.deliverTo.name} 
                onChange={(e) => handleChange(e, 'deliverTo', 'name')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              /> */}
              <input 
                type="text" 
                placeholder="Company Name" 
                value={formData.deliverTo.company} 
                onChange={(e) => handleChange(e, 'deliverTo', 'company')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
              <input 
                type="text" 
                placeholder="Address Line 1" 
                value={formData.deliverTo.address1} 
                onChange={(e) => handleChange(e, 'deliverTo', 'address1')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
              <input 
                type="text" 
                placeholder="City, State, Zip" 
                value={formData.deliverTo.address2} 
                onChange={(e) => handleChange(e, 'deliverTo', 'address2')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
            </div>
          </div>

          <div className="border border-black flex flex-col w-full md:w-1/2">
            <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Work For:</div>
            <div className="p-2 space-y-1 flex-1 flex flex-col justify-between">
              {/* <div aria-hidden="true" className="p-1 text-sm invisible select-none">Spacer</div> */}
              <input 
                type="text" 
                placeholder="Company Name" 
                value={formData.workFor.company} 
                onChange={(e) => handleChange(e, 'workFor', 'company')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
              <input 
                type="text" 
                placeholder="Address Line 1" 
                value={formData.workFor.address1} 
                onChange={(e) => handleChange(e, 'workFor', 'address1')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
              <input 
                type="text" 
                placeholder="City, State, Zip" 
                value={formData.workFor.address2} 
                onChange={(e) => handleChange(e, 'workFor', 'address2')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-1 text-sm bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* INSTRUCTIONS */}
        <div className="border border-black">
          <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Instructions:</div>
          <div className="p-1">
            <input 
              type="text" 
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              placeholder="e.g. Bond Forms (G-501) Blue Statements"
              className="w-full focus:outline-none p-1 font-medium"
            />
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="border border-black">
          <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Details:</div>
          <div className="p-2">
            <textarea 
              name="details"
              rows={6}
              value={formData.details}
              onChange={handleChange}
              placeholder="Enter detailed items, bullet points, or packaging instructions..."
              className="w-full focus:outline-none resize-none text-xs"
            />
          </div>
        </div>

        {/* RECEIVED BY, EMAIL & SIGNATURE */}
        <div className="border border-black p-3 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-1/2">
              <span className="font-bold whitespace-nowrap">Received By:</span>
              <input 
                type="text" 
                name="receivedByName"
                value={formData.receivedByName}
                onChange={handleChange}
                className="border-b border-black flex-1 focus:outline-none px-1"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-1/3">
              <span className="font-bold whitespace-nowrap">Date:</span>
              <input 
                type="date" 
                name="receiveDate"
                value={formData.receiveDate}
                onChange={handleChange}
                className="border-b border-black flex-1 focus:outline-none px-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full pt-1">
            <span className="font-bold whitespace-nowrap">Client Email:</span>
            <input 
              type="email" 
              name="clientEmail"
              value={formData.clientEmail}
              onChange={handleChange}
              placeholder="client@company.com"
              className="border-b border-black flex-1 focus:outline-none px-1 text-xs"
            />
          </div>

          <div className="pt-2">
            <div className="font-bold mb-1">Client Signature: *</div>
            <div className="border border-dashed border-gray-500 bg-gray-50 p-1 w-full max-w-[450px] mx-auto overflow-hidden">
              <canvas 
                ref={canvasRef}
                width={800}
                height={400}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDrawing(e);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  draw(e);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDrawing();
                }}
                className="bg-white cursor-crosshair border border-gray-300 w-full sm:w-[450px]"
                style={{ touchAction: 'none' }}
              />
            </div>
            <div>
              <button 
                type="button" 
                onClick={clearSignature}
                className="text-[10px] text-red-600 hover:underline mt-1 font-semibold"
              >
                Clear Signature
              </button>
            </div>
          </div>
        </div>

        {/* TGI INTERNAL USE */}
        <div className="border border-black">
          <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">TGI Internal Use:</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-black divide-y sm:divide-y-0 sm:divide-x divide-black text-[11px]">
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Driver:</span>
              <input 
                type="text" 
                value={formData.internalUse.driver}
                onChange={(e) => handleChange(e, 'internalUse', 'driver')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Vehicle:</span>
              <input 
                type="text" 
                value={formData.internalUse.vehicle}
                onChange={(e) => handleChange(e, 'internalUse', 'vehicle')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Zone:</span>
              <input 
                type="text" 
                value={formData.internalUse.zone}
                onChange={(e) => handleChange(e, 'internalUse', 'zone')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-black text-[11px]">
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Bill:</span>
              <input 
                type="text" 
                value={formData.internalUse.bill}
                onChange={(e) => handleChange(e, 'internalUse', 'bill')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Hrs:</span>
              <input 
                type="text" 
                value={formData.internalUse.hrs}
                onChange={(e) => handleChange(e, 'internalUse', 'hrs')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">Min:</span>
              <input 
                type="text" 
                value={formData.internalUse.min}
                onChange={(e) => handleChange(e, 'internalUse', 'min')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
            <div className="p-1 flex items-center gap-1">
              <span className="font-semibold">By:</span>
              <input 
                type="text" 
                value={formData.internalUse.by}
                onChange={(e) => handleChange(e, 'internalUse', 'by')}
                className="flex-1 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* FOOTER & ACTIONS */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
          <div className="text-gray-500 italic text-[11px]">Page 1 of 1</div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-black bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 bg-black text-white hover:bg-gray-800 text-xs font-semibold rounded"
            >
              Save Delivery Request
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}