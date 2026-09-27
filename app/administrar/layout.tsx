import type { Metadata } from "next"
import { getRoleUser } from "@action/get-role-action"
import DashboardClient from "@/app/administrar/dashboard-client"

export const metadata: Metadata = {
    title: "Panel",
}

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const role = await getRoleUser()

    return <DashboardClient role={role}>{children}</DashboardClient>
}
