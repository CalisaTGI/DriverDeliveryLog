import BillingDashboardPage from "./pages/BillingDashboardPage";
import DriverDeliveryLogPage from "./pages/DriverDeliveryLogPage";

export default function App() {
  const isAdminPath =
    typeof window !== "undefined" && window.location.pathname === "/admin";

  if (isAdminPath) {
    return <BillingDashboardPage />;
  }

  return <DriverDeliveryLogPage />;
}