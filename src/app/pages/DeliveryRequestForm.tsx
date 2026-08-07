import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getApiUrl } from '../lib/apiConfig';

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

  const [formData, setFormData] = useState<DeliveryFormState>({
    job: '',
    task: '',
    description: '',
    date: getTodayDate(), // Defaults to today, but fully changeable
    deliverTo: { name: '', company: '', address1: '', address2: '' },
    workFor: { company: '', address1: '', address2: '' },
    instructions: '',
    details: '',
    receivedByName: '',
    receiveDate: getTodayDate(), // Defaults to today, but fully changeable
    clientSignature: '',
    internalUse: { driver: '', vehicle: '', zone: '', bill: '', hrs: '', min: '', by: '' },
    clientEmail: ''
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, 
    section?: 'deliverTo' | 'workFor' | 'internalUse', 
    field?: string
  ) => {
    if (section && field) {
      setFormData(prev => ({
        ...prev,
        [section]: { ...prev[section], [field]: e.target.value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFormData(prev => ({ ...prev, clientSignature: canvas.toDataURL() }));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData(prev => ({ ...prev, clientSignature: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.job) {
      alert('Please enter a Job number.');
      return;
    }

    const canvas = canvasRef.current;
    const signatureData = canvas ? canvas.toDataURL() : formData.clientSignature;

    if (!signatureData) {
      alert('Client signature is required.');
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/delivery-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          jobNumber: formData.job,
          clientSignature: signatureData,
          clientEmail: formData.clientEmail,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save delivery request.');

      alert('Delivery request successfully saved!');
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-white border border-gray-400 shadow-sm my-4 sm:my-6 font-sans text-xs text-black">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* HEADER SECTION */}
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
              <input 
                type="text" 
                name="job" 
                value={formData.job} 
                onChange={handleChange} 
                placeholder="268337"
                className="w-full text-center focus:outline-none bg-transparent px-0.5"
                required
              />
              <input 
                type="text" 
                name="task" 
                value={formData.task} 
                onChange={handleChange} 
                placeholder="P"
                className="w-full text-center focus:outline-none bg-transparent px-0.5"
              />
              <input 
                type="text" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                placeholder="06.26"
                className="w-full text-center focus:outline-none bg-transparent px-0.5"
              />
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleChange} 
                className="w-full text-[9px] sm:text-[10px] text-center focus:outline-none bg-transparent px-0.5"
              />
            </div>
          </div>
        </div>

        {/* DELIVER TO & WORK FOR BOXES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-black">
            <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Deliver To:</div>
            <div className="p-2 space-y-1">
              <input 
                type="text" 
                placeholder="Recipient Name (e.g. Gary Coulier)" 
                value={formData.deliverTo.name} 
                onChange={(e) => handleChange(e, 'deliverTo', 'name')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-0.5"
              />
              <input 
                type="text" 
                placeholder="Company Name" 
                value={formData.deliverTo.company} 
                onChange={(e) => handleChange(e, 'deliverTo', 'company')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-0.5"
              />
              <input 
                type="text" 
                placeholder="Address Line 1" 
                value={formData.deliverTo.address1} 
                onChange={(e) => handleChange(e, 'deliverTo', 'address1')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-0.5"
              />
              <input 
                type="text" 
                placeholder="City, State, Zip" 
                value={formData.deliverTo.address2} 
                onChange={(e) => handleChange(e, 'deliverTo', 'address2')}
                className="w-full focus:outline-none p-0.5"
              />
            </div>
          </div>

          <div className="border border-black">
            <div className="bg-gray-200 border-b border-black px-2 py-1 font-bold">Work For:</div>
            <div className="p-2 space-y-1">
              <input 
                type="text" 
                placeholder="Company Name" 
                value={formData.workFor.company} 
                onChange={(e) => handleChange(e, 'workFor', 'company')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-0.5"
              />
              <input 
                type="text" 
                placeholder="Address Line 1" 
                value={formData.workFor.address1} 
                onChange={(e) => handleChange(e, 'workFor', 'address1')}
                className="w-full border-b border-dashed border-gray-400 focus:outline-none p-0.5"
              />
              <input 
                type="text" 
                placeholder="City, State, Zip" 
                value={formData.workFor.address2} 
                onChange={(e) => handleChange(e, 'workFor', 'address2')}
                className="w-full focus:outline-none p-0.5"
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
            <div className="border border-dashed border-gray-500 bg-gray-50 p-1 inline-block w-full sm:w-auto overflow-x-auto">
              <canvas 
                ref={canvasRef}
                width={450}
                height={100}
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