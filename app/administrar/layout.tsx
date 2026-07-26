import { getRoleUser } from "@action/get-role-action";
import DashboardClient from "./dashboard-client";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const role = await getRoleUser();

    return <DashboardClient role={role}>{children}</DashboardClient>;
}
