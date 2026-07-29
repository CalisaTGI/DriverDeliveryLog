import BillingDashboardPage from "./pages/BillingDashboardPage";
import DriverDeliveryLogPage from "./pages/DriverDeliveryLogPage";
import { SwUpdatePrompt } from "../offline/SwUpdatePrompt";
import { OfflineStatusBanner } from "../offline/OfflineStatusBanner";

export default function App() {
  const isAdminPath =
    typeof window !== "undefined" && window.location.pathname === "/admin";

  return (
    <>
      <SwUpdatePrompt />
      <OfflineStatusBanner />
      {isAdminPath ? <BillingDashboardPage /> : <DriverDeliveryLogPage />}
    </>
  );
}
