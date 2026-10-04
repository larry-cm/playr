import type { Metadata } from "next"
import { getRoleUser } from "@action/get-role-action"
import { redirect } from "next/navigation"
import DashboardClient from "@/app/administrar/dashboard-client"
import SesionTabProvider from "@/app/administrar/sesion-tab"
import { getSid } from "@lib/supabase/server"

export const metadata: Metadata = {
    title: "Panel",
}

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const sid = await getSid()
    if (!sid) redirect("/")
    const role = await getRoleUser()

    return (
        <SesionTabProvider sid={sid}>
            <DashboardClient role={role}>{children}</DashboardClient>
        </SesionTabProvider>
    )
}
