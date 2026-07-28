import BillingDashboard from "./BillingDashboard";
import DriverDeliveryLogPage from "./pages/DriverDeliveryLogPage";

export default function App() {
  const isAdminPath = typeof window !== "undefined" && window.location.pathname === "/admin";

  if (isAdminPath) {
    return <BillingDashboard />;
  }

  return <DriverDeliveryLogPage />;
}