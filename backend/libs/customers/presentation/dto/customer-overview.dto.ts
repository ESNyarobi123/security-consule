import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Module 6-A — staff customer 360 (read aggregation). */
export class CustomerOverviewCountsDto {
  @ApiProperty() sites!: number;
  @ApiProperty() contracts!: number;
  @ApiProperty() employees!: number;
  @ApiProperty() activeGuards!: number;
  @ApiProperty() invoices!: number;
  @ApiProperty() openInvoices!: number;
  @ApiProperty() overdueInvoices!: number;
  @ApiProperty() openServiceRequests!: number;
  @ApiProperty() openComplaints!: number;
  @ApiProperty() openIncidents!: number;
  @ApiProperty() vehicles!: number;
  @ApiProperty() activePermits!: number;
  @ApiProperty() accessEntries30d!: number;
  @ApiProperty() pendingAppointments!: number;
}

export class CustomerOverviewBillingDto {
  @ApiProperty() currency!: string;
  @ApiProperty({ description: 'Sum of (total − paid) on non-void open invoices' })
  outstandingAmount!: number;
  @ApiProperty() paidAmount!: number;
}

export class CustomerOverviewContractRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() contractNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() serviceType!: string;
  @ApiProperty() monthlyFee!: number;
  @ApiProperty() currency!: string;
}

export class CustomerOverviewGuardRowDto {
  @ApiProperty() deploymentId!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() guardNumber!: string;
  @ApiPropertyOptional() fullName!: string | null;
  @ApiProperty() siteCode!: string;
  @ApiProperty() siteName!: string;
  @ApiProperty() status!: string;
}

export class CustomerOverviewInvoiceRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() amountPaid!: number;
  @ApiProperty() balance!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() dueDate!: string;
}

export class CustomerOverviewIncidentRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() incidentNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() siteCode!: string | null;
  @ApiProperty() createdAt!: string;
}

export class CustomerOverviewServiceRequestRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty() category!: string;
  @ApiProperty() status!: string;
  @ApiProperty() urgency!: string;
  @ApiProperty() createdAt!: string;
}

export class CustomerOverviewComplaintRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty() title!: string;
  @ApiProperty() category!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
}

export class CustomerOverviewEmployeeRowDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() employeeNumber!: string | null;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() department!: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CustomerOverviewVehicleRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() plateNumber!: string;
  @ApiProperty() vehicleType!: string;
  @ApiPropertyOptional() ownerName!: string | null;
  @ApiProperty() isActive!: boolean;
}

export class CustomerOverviewResponseDto {
  @ApiProperty() customerId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: CustomerOverviewCountsDto })
  counts!: CustomerOverviewCountsDto;
  @ApiProperty({ type: CustomerOverviewBillingDto })
  billing!: CustomerOverviewBillingDto;
  @ApiProperty({ type: [CustomerOverviewContractRowDto] })
  contracts!: CustomerOverviewContractRowDto[];
  @ApiProperty({ type: [CustomerOverviewGuardRowDto] })
  guards!: CustomerOverviewGuardRowDto[];
  @ApiProperty({ type: [CustomerOverviewInvoiceRowDto] })
  invoices!: CustomerOverviewInvoiceRowDto[];
  @ApiProperty({ type: [CustomerOverviewIncidentRowDto] })
  incidents!: CustomerOverviewIncidentRowDto[];
  @ApiProperty({ type: [CustomerOverviewServiceRequestRowDto] })
  serviceRequests!: CustomerOverviewServiceRequestRowDto[];
  @ApiProperty({ type: [CustomerOverviewComplaintRowDto] })
  complaints!: CustomerOverviewComplaintRowDto[];
  @ApiProperty({ type: [CustomerOverviewEmployeeRowDto] })
  employees!: CustomerOverviewEmployeeRowDto[];
  @ApiProperty({ type: [CustomerOverviewVehicleRowDto] })
  vehicles!: CustomerOverviewVehicleRowDto[];
}
