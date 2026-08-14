import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import BillingDashboardPage from "./pages/BillingDashboardPage";
import DriverDeliveryLogPage from "./pages/DriverDeliveryLogPage";
import DeliveryRequestForm from './pages/DeliveryRequestForm';
import { SwUpdatePrompt } from "../offline/SwUpdatePrompt";
import { OfflineStatusBanner } from "../offline/OfflineStatusBanner";

export default function App() {
  return (
    <BrowserRouter>
      <SwUpdatePrompt />
      <OfflineStatusBanner />
      
      <Routes>
        {/* Main Driver Delivery Log Page */}
        <Route path="/" element={<DriverDeliveryLogPage />} />

        {/* Admin Billing Dashboard */}
        <Route path="/admin" element={<BillingDashboardPage />} />

        {/* New Delivery Request Form Page */}
        <Route path="/delivery-request" element={<DeliveryRequestForm />} />
      </Routes>
    </BrowserRouter>
  );
}