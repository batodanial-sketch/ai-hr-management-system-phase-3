import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmployees } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "@/components/employees/employee-form";

export const metadata: Metadata = {
  title: "Edit Employee",
};

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, employees] = await Promise.all([params, getEmployees()]);
  const employee = employees.find((item) => item.id === id);

  if (!employee) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit employee</h1>
        <p className="text-sm text-muted-foreground">
          Update this employee’s details in the active workspace.
        </p>
      </div>
      <Card className="glass">
        <CardHeader>
          <CardTitle>{employee.firstName} {employee.lastName}</CardTitle>
          <CardDescription>
            Changes are saved to this employee record without creating a duplicate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            mode="edit"
            employeeId={employee.id}
            initialValues={{
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              department: employee.department,
              role: employee.role,
              startDate: employee.startDate,
              location: employee.location,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
