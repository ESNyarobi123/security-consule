/**
 * Idempotent demo volume seed (~20 rows per major list entity).
 * Prefix: VOL-* — keeps core demos (CUST-DEMO, GRD-0001, admin@, …) intact.
 */
import {
  PrismaClient,
  ContractStatus,
  type GuardStatus,
  type InvoiceStatus,
  type AppointmentStatus,
  type ComplaintStatus,
  type ServiceRequestStatus,
  type AlertnessStatus,
  type IncidentStatus,
  type IncidentSeverity,
  type DeploymentStatus,
  type ParkingDecision,
  type PermitStatus,
  type VehicleType,
  type PermitType,
  type ViolationType,
  type LoanStatus,
  type PettyCashVoucherStatus,
  type AssetStatus,
  type DeviceType,
  type DeviceConnection,
  type DeviceStatus,
  type ApplicationStatus,
  type GuardSupplyRequestStatus,
  type LeaveRequestStatus,
  type PolicyStatus,
  type BreachStatus,
  type BreachSeverity,
  type CustomerContactRole,
  type CustomerLifecycleStatus,
  type AccessLevel,
  type VerificationResult,
  type VisitorEntryDirection,
  type ParkingEntryDirection,
} from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';

const N = 20;

function verificationCodeSecret(): string {
  return (
    process.env.VISITOR_CODE_SECRET ||
    process.env.JWT_SECRET ||
    'pssms-dev-visitor-code-secret'
  );
}

function hashGateCode(plain: string): string {
  return createHmac('sha256', verificationCodeSecret())
    .update(plain.trim().toUpperCase())
    .digest('hex');
}

function apiKeyHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export type DemoVolumeCtx = {
  organizationId: string;
  customerId: string;
  siteWarehouseId: string;
  siteOfficeId: string;
  branchId: string;
  contractGuardId: string | null;
  adminUserId: string;
  supervisorUserId: string;
  opsUserId: string;
  portalUserId: string;
  gateMainId: string | null;
  passwordHash: string;
  guardRoleId: string;
};

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function daysAgo(d: number): Date {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - d);
  return x;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}

function daysFromNow(d: number): Date {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() + d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function resolveCtx(
  prisma: PrismaClient,
  partial?: Partial<DemoVolumeCtx>,
): Promise<DemoVolumeCtx> {
  let org =
    partial?.organizationId
      ? await prisma.organization.findUnique({ where: { id: partial.organizationId } })
      : await prisma.organization.findUnique({ where: { code: 'HIGHLINK' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        code: 'HIGHLINK',
        name: 'Highlink Investigation and Security Guard Company Limited',
        email: 'info@highlink.co.tz',
        phone: '+255700000000',
      },
    });
  }

  const passwordHash =
    partial?.passwordHash ?? (await bcrypt.hash('ChangeMe123!', 12));

  let admin =
    partial?.adminUserId
      ? await prisma.user.findUnique({ where: { id: partial.adminUserId } })
      : await prisma.user.findUnique({ where: { email: 'admin@highlink.co.tz' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@highlink.co.tz',
        fullName: 'System Admin',
        passwordHash,
        organizationId: org.id,
      },
    });
  }

  let supervisor =
    partial?.supervisorUserId
      ? await prisma.user.findUnique({ where: { id: partial.supervisorUserId } })
      : await prisma.user.findUnique({
          where: { email: 'supervisor1@highlink.co.tz' },
        });
  if (!supervisor) supervisor = admin;

  let ops =
    partial?.opsUserId
      ? await prisma.user.findUnique({ where: { id: partial.opsUserId } })
      : await prisma.user.findUnique({ where: { email: 'ops1@highlink.co.tz' } });
  if (!ops) ops = admin;

  let branch =
    partial?.branchId
      ? await prisma.branch.findUnique({ where: { id: partial.branchId } })
      : await prisma.branch.findFirst({
          where: { organizationId: org.id, code: 'DSM-HQ' },
        });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'DSM-HQ',
        name: 'Dar es Salaam HQ',
        region: 'Dar es Salaam',
        createdBy: admin.id,
      },
    });
  }

  let customer =
    partial?.customerId
      ? await prisma.customer.findUnique({ where: { id: partial.customerId } })
      : await prisma.customer.findFirst({
          where: { organizationId: org.id, code: 'CUST-DEMO' },
        });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        code: 'CUST-DEMO',
        name: 'Demo Manufacturing Ltd',
        status: 'ACTIVE',
        createdBy: admin.id,
      },
    });
  }

  let siteWh =
    partial?.siteWarehouseId
      ? await prisma.site.findUnique({ where: { id: partial.siteWarehouseId } })
      : await prisma.site.findFirst({
          where: { organizationId: org.id, code: 'SITE-WAREHOUSE-A' },
        });
  if (!siteWh) {
    siteWh = await prisma.site.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        customerId: customer.id,
        code: 'SITE-WAREHOUSE-A',
        name: 'Warehouse A',
        createdBy: admin.id,
      },
    });
  }

  let siteOffice =
    partial?.siteOfficeId
      ? await prisma.site.findUnique({ where: { id: partial.siteOfficeId } })
      : await prisma.site.findFirst({
          where: { organizationId: org.id, code: 'SITE-OFFICE-DEMO' },
        });
  if (!siteOffice) {
    siteOffice = await prisma.site.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        customerId: customer.id,
        code: 'SITE-OFFICE-DEMO',
        name: 'Demo HQ Offices',
        createdBy: admin.id,
      },
    });
  }

  const contract =
    partial?.contractGuardId
      ? await prisma.contract.findUnique({
          where: { id: partial.contractGuardId },
          select: { id: true },
        })
      : await prisma.contract.findFirst({
          where: {
            organizationId: org.id,
            contractNumber: 'CTR-DEMO-GUARD-2026',
          },
          select: { id: true },
        });

  let portal =
    partial?.portalUserId
      ? await prisma.user.findUnique({ where: { id: partial.portalUserId } })
      : await prisma.user.findUnique({
          where: { email: 'portal@demo-mfg.co.tz' },
        });
  if (!portal) portal = admin;

  const gate =
    partial?.gateMainId
      ? await prisma.gate.findUnique({ where: { id: partial.gateMainId } })
      : await prisma.gate.findFirst({
          where: {
            organizationId: org.id,
            siteId: siteWh.id,
            code: 'GATE-MAIN',
          },
        });

  let guardRole =
    partial?.guardRoleId
      ? await prisma.role.findUnique({ where: { id: partial.guardRoleId } })
      : await prisma.role.findFirst({
          where: { organizationId: org.id, code: 'GUARD' },
        });
  if (!guardRole) {
    guardRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        code: 'GUARD',
        name: 'Security Guard',
        isSystem: true,
      },
    });
  }

  return {
    organizationId: org.id,
    customerId: customer.id,
    siteWarehouseId: siteWh.id,
    siteOfficeId: siteOffice.id,
    branchId: branch.id,
    contractGuardId: contract?.id ?? null,
    adminUserId: admin.id,
    supervisorUserId: supervisor.id,
    opsUserId: ops.id,
    portalUserId: portal.id,
    gateMainId: gate?.id ?? null,
    passwordHash,
    guardRoleId: guardRole.id,
  };
}

const FIRST = [
  'Amani', 'Baraka', 'Chipo', 'Dotto', 'Elias', 'Faraja', 'Grace', 'Halima',
  'Imani', 'Juma', 'Kelvin', 'Lulu', 'Mwajuma', 'Neema', 'Oscar', 'Pendo',
  'Rehema', 'Said', 'Tatu', 'Upendo',
];
const LAST = [
  'Mwamba', 'Kileo', 'Hassan', 'Ally', 'Kimaro', 'Ngowi', 'Msuya', 'Shabani',
  'Mushi', 'Lyimo', 'Massawe', 'Komba', 'Mbwambo', 'Swai', 'Tarimo', 'Mollel',
  'Kisanga', 'Mrema', 'Chacha', 'Njau',
];

export async function seedDemoVolume(
  prisma: PrismaClient,
  partialCtx?: Partial<DemoVolumeCtx>,
): Promise<void> {
  const ctx = await resolveCtx(prisma, partialCtx);
  const orgId = ctx.organizationId;
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  console.log('Demo volume seed: starting (VOL-* ~20/entity)…');

  // ── Customers VOL-CUST-01..20 ──────────────────────────────────────────
  const volCustomerIds: string[] = [];
  const categories = ['INDUSTRIAL', 'COMMERCIAL', 'BANKING', 'GOVERNMENT', 'RESIDENTIAL'];
  const statuses: CustomerLifecycleStatus[] = [
    'ACTIVE',
    'ACTIVE',
    'ACTIVE',
    'PROSPECT',
    'SUSPENDED',
  ];
  for (let i = 1; i <= N; i++) {
    const code = `VOL-CUST-${pad(i)}`;
    const row = await prisma.customer.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      update: {
        name: `Volume Customer ${pad(i)} Ltd`,
        status: statuses[(i - 1) % statuses.length]!,
        isActive: statuses[(i - 1) % statuses.length] !== 'SUSPENDED',
      },
      create: {
        organizationId: orgId,
        code,
        name: `Volume Customer ${pad(i)} Ltd`,
        tradingName: `VolCust ${pad(i)}`,
        email: `ops@vol-cust-${pad(i)}.co.tz`,
        phone: `+2557559${pad(i, 4)}`,
        city: 'Dar es Salaam',
        region: 'Dar es Salaam',
        country: 'Tanzania',
        category: categories[(i - 1) % categories.length],
        industry: 'Mixed',
        ranking: i <= 5 ? 'IMPORTANT' : 'NORMAL',
        status: statuses[(i - 1) % statuses.length]!,
        serviceTypes: ['GUARD', 'CCTV'],
        currency: 'TZS',
        paymentTerms: 'NET_30',
        createdBy: ctx.adminUserId,
      },
    });
    volCustomerIds.push(row.id);
    bump('customers');
  }

  // ── Sites VOL-SITE-01..20 ──────────────────────────────────────────────
  const volSiteIds: string[] = [];
  for (let i = 1; i <= N; i++) {
    const code = `VOL-SITE-${pad(i)}`;
    const custId =
      i <= 8 ? ctx.customerId : volCustomerIds[(i - 1) % volCustomerIds.length]!;
    const row = await prisma.site.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      update: {
        name: `Volume Site ${pad(i)}`,
        customerId: custId,
        branchId: ctx.branchId,
        isActive: true,
      },
      create: {
        organizationId: orgId,
        branchId: ctx.branchId,
        customerId: custId,
        code,
        name: `Volume Site ${pad(i)}`,
        address: `Plot ${100 + i}, Volume Industrial Park, DSM`,
        latitude: -6.8 - i * 0.002,
        longitude: 39.28 + i * 0.002,
        createdBy: ctx.adminUserId,
      },
    });
    volSiteIds.push(row.id);
    bump('sites');
  }

  const sitePick = (i: number) =>
    i % 3 === 0
      ? ctx.siteOfficeId
      : i % 2 === 0
        ? volSiteIds[(i - 1) % volSiteIds.length]!
        : ctx.siteWarehouseId;

  // ── Contracts VOL-CTR-01..20 ───────────────────────────────────────────
  const volContractIds: string[] = [];
  const ctrStatuses: ContractStatus[] = [
    ContractStatus.ACTIVE,
    ContractStatus.ACTIVE,
    ContractStatus.APPROVED,
    ContractStatus.DRAFT,
    ContractStatus.EXPIRING,
    ContractStatus.PENDING_APPROVAL,
  ];
  const serviceTypes = [
    'SECURITY_GUARD',
    'CCTV_MONITORING',
    'VISITOR_MANAGEMENT',
    'PARKING',
    'ACCESS_CONTROL',
  ];
  for (let i = 1; i <= N; i++) {
    const contractNumber = `VOL-CTR-${pad(i)}`;
    const custId =
      i <= 10 ? ctx.customerId : volCustomerIds[(i - 1) % volCustomerIds.length]!;
    const st = serviceTypes[(i - 1) % serviceTypes.length]!;
    const start = daysFromNow(-90 - i);
    const end = daysFromNow(180 + i * 3);
    const row = await prisma.contract.upsert({
      where: {
        organizationId_contractNumber: {
          organizationId: orgId,
          contractNumber,
        },
      },
      update: {
        customerId: custId,
        status: ctrStatuses[(i - 1) % ctrStatuses.length]!,
        title: `Volume ${st.replace(/_/g, ' ')} — ${contractNumber}`,
      },
      create: {
        organizationId: orgId,
        customerId: custId,
        contractNumber,
        title: `Volume ${st.replace(/_/g, ' ')} — ${contractNumber}`,
        serviceType: st,
        serviceTypes: [st],
        status: ctrStatuses[(i - 1) % ctrStatuses.length]!,
        startDate: start,
        endDate: end,
        monthlyFee: 500_000 + i * 75_000,
        currency: 'TZS',
        paymentTerms: 'NET_30',
        contractKind: 'NEW',
        noticePeriodDays: 30,
        invoiceFrequency: 'MONTHLY',
        vatApplicable: true,
        slaLevel: i % 3 === 0 ? 'PREMIUM' : 'STANDARD',
        guardCount: st === 'SECURITY_GUARD' ? 4 + (i % 8) : 0,
        slaTerms: 'Volume seed SLA terms',
        createdBy: ctx.adminUserId,
      },
    });
    volContractIds.push(row.id);
    bump('contracts');
    // Link CUST-DEMO volume contracts to warehouse/office
    if (custId === ctx.customerId) {
      const sid = i % 2 === 0 ? ctx.siteOfficeId : ctx.siteWarehouseId;
      await prisma.contractSite.upsert({
        where: {
          contractId_siteId: { contractId: row.id, siteId: sid },
        },
        update: {},
        create: {
          organizationId: orgId,
          contractId: row.id,
          siteId: sid,
        },
      });
    }
  }

  // ── Guards VOL-GRD-01..20 (+ Employee) ─────────────────────────────────
  const volGuardIds: string[] = [];
  const guardStatuses: GuardStatus[] = [
    'ACTIVE',
    'ACTIVE',
    'ACTIVE',
    'AVAILABLE',
    'ON_LEAVE',
    'ABSENT',
    'SUSPENDED',
  ];
  for (let i = 1; i <= N; i++) {
    const num = `VOL-GRD-${pad(i)}`;
    const email = `vol.grd.${pad(i)}@highlink.co.tz`;
    const fullName = `${FIRST[(i - 1) % FIRST.length]} ${LAST[(i - 1) % LAST.length]}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { fullName, organizationId: orgId },
      create: {
        email,
        fullName,
        passwordHash: ctx.passwordHash,
        organizationId: orgId,
        phone: `+2557129${pad(i, 4)}`,
        roles: { create: [{ roleId: ctx.guardRoleId }] },
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: ctx.guardRoleId },
      },
      update: {},
      create: { userId: user.id, roleId: ctx.guardRoleId },
    });
    const status = guardStatuses[(i - 1) % guardStatuses.length]!;
    const gp = await prisma.guardProfile.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: orgId,
          employeeNumber: num,
        },
      },
      update: {
        userId: user.id,
        status,
        phone: user.phone,
        deploymentEligible: status === 'ACTIVE' || status === 'AVAILABLE',
        trainingCompleted: i % 2 === 0,
        clearanceVerified: i % 3 === 0,
        medicalFitnessVerified: i % 4 === 0,
        uniformIssued: i % 2 === 1,
        equipmentIssued: i % 3 === 1,
      },
      create: {
        organizationId: orgId,
        userId: user.id,
        employeeNumber: num,
        status,
        phone: `+2557129${pad(i, 4)}`,
        deploymentEligible: status === 'ACTIVE' || status === 'AVAILABLE',
        trainingCompleted: i % 2 === 0,
        clearanceVerified: i % 3 === 0,
        medicalFitnessVerified: i % 4 === 0,
        uniformIssued: i % 2 === 1,
        equipmentIssued: i % 3 === 1,
        nationalIdRef: `NIDA-VOL-${pad(i)}`,
      },
    });
    await prisma.employee.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: orgId,
          employeeNumber: num,
        },
      },
      update: {
        guardProfileId: gp.id,
        userId: user.id,
        fullName,
        email,
        status: 'ACTIVE',
      },
      create: {
        organizationId: orgId,
        userId: user.id,
        guardProfileId: gp.id,
        employeeNumber: num,
        fullName,
        email,
        phone: `+2557129${pad(i, 4)}`,
        department: 'Operations',
        employmentType: 'GUARD',
        hireDate: daysFromNow(-365 - i * 10),
        createdBy: ctx.adminUserId,
      },
    });
    volGuardIds.push(gp.id);
    bump('guards');
  }

  // ── Deployments (ACTIVE/ENDED mix for subset) ──────────────────────────
  for (let i = 1; i <= N; i++) {
    const guardId = volGuardIds[i - 1]!;
    const status: DeploymentStatus = i <= 12 ? 'ACTIVE' : 'ENDED';
    const siteId = sitePick(i);
    const existing = await prisma.guardDeployment.findFirst({
      where: {
        organizationId: orgId,
        guardId,
        // stable marker via createdBy + startDate day key
        createdBy: ctx.adminUserId,
        startDate: daysFromNow(status === 'ACTIVE' ? -30 - i : -120 - i),
      },
    });
    // Prefer one row per guard marked by remarks-free stable find on createdBy+status
    const byStatus = await prisma.guardDeployment.findFirst({
      where: {
        organizationId: orgId,
        guardId,
        status,
        createdBy: ctx.adminUserId,
      },
    });
    if (byStatus) {
      await prisma.guardDeployment.update({
        where: { id: byStatus.id },
        data: {
          siteId,
          contractId:
            siteId === ctx.siteWarehouseId || siteId === ctx.siteOfficeId
              ? (ctx.contractGuardId ?? volContractIds[0] ?? null)
              : (volContractIds[(i - 1) % volContractIds.length] ?? null),
        },
      });
    } else if (!existing) {
      await prisma.guardDeployment.create({
        data: {
          organizationId: orgId,
          guardId,
          siteId,
          contractId:
            siteId === ctx.siteWarehouseId || siteId === ctx.siteOfficeId
              ? (ctx.contractGuardId ?? volContractIds[0] ?? null)
              : (volContractIds[(i - 1) % volContractIds.length] ?? null),
          startDate: daysFromNow(status === 'ACTIVE' ? -30 - i : -120 - i),
          endDate: status === 'ENDED' ? daysFromNow(-10 - (i % 5)) : null,
          status,
          createdBy: ctx.adminUserId,
        },
      });
    }
    bump('deployments');
  }

  // ── Shifts VOL-SHF-01..20 ──────────────────────────────────────────────
  const volShiftIds: string[] = [];
  for (let i = 1; i <= N; i++) {
    const name = `VOL-SHF-${pad(i)}`;
    const siteId = sitePick(i);
    let shift = await prisma.shift.findFirst({
      where: { organizationId: orgId, name },
    });
    const startAt = hoursAgo(24 * (i % 7) - 8);
    const endAt = new Date(startAt.getTime() + 8 * 3600_000);
    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          organizationId: orgId,
          siteId,
          name,
          startAt,
          endAt,
          status: i % 4 === 0 ? 'COMPLETED' : i % 3 === 0 ? 'ACTIVE' : 'SCHEDULED',
          instructions: `Volume shift ${pad(i)}`,
          createdBy: ctx.opsUserId,
        },
      });
    } else {
      shift = await prisma.shift.update({
        where: { id: shift.id },
        data: { siteId, startAt, endAt },
      });
    }
    volShiftIds.push(shift.id);
    bump('shifts');
  }

  // ── Attendance ~20 recent days ─────────────────────────────────────────
  for (let i = 1; i <= N; i++) {
    const clientEventId = `vol-att-${pad(i)}`;
    const guardId = volGuardIds[(i - 1) % volGuardIds.length]!;
    const siteId = sitePick(i);
    const clockInAt = hoursAgo(i * 5 + 2);
    const closed = i % 3 !== 0;
    const existing = await prisma.guardAttendance.findFirst({
      where: { clientEventId },
    });
    if (!existing) {
      await prisma.guardAttendance.create({
        data: {
          organizationId: orgId,
          guardId,
          siteId,
          shiftId: volShiftIds[(i - 1) % volShiftIds.length],
          clockInAt,
          clockOutAt: closed
            ? new Date(clockInAt.getTime() + 8 * 3600_000)
            : null,
          clockInMethod: i % 2 === 0 ? 'MOBILE_GPS' : 'QR',
          clockOutMethod: closed ? 'MOBILE_GPS' : null,
          clientEventId,
          supervisorApproved: i % 2 === 0,
          remarks: `[VOL-ATT-${pad(i)}] Volume attendance seed`,
        },
      });
    }
    bump('attendance');
  }

  // ── AlertnessCheck ~20 ─────────────────────────────────────────────────
  const alertStatuses: AlertnessStatus[] = [
    'CONFIRMED',
    'LATE',
    'MISSED',
    'SCHEDULED',
    'CANCELLED',
  ];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-ALT-${pad(i)}`;
    const guardId = volGuardIds[(i - 1) % volGuardIds.length]!;
    const siteId = sitePick(i);
    const status = alertStatuses[(i - 1) % alertStatuses.length]!;
    const scheduledAt = hoursAgo(i * 3);
    await prisma.alertnessCheck.upsert({
      where: { referenceNumber },
      update: {
        guardId,
        siteId,
        status,
        scheduledAt,
        confirmedAt:
          status === 'CONFIRMED' || status === 'LATE'
            ? new Date(scheduledAt.getTime() + 5 * 60_000)
            : null,
      },
      create: {
        organizationId: orgId,
        guardId,
        siteId,
        referenceNumber,
        scheduledAt,
        status,
        method: status === 'CONFIRMED' || status === 'LATE' ? 'MOBILE_GPS' : null,
        confirmedAt:
          status === 'CONFIRMED' || status === 'LATE'
            ? new Date(scheduledAt.getTime() + 5 * 60_000)
            : null,
        supervisorRemarks:
          status === 'MISSED' ? 'Volume seed miss note' : null,
      },
    });
    bump('alertness');
  }

  // ── FieldAlert open/ack mix ────────────────────────────────────────────
  const alertTypes = [
    'ALERTNESS_MISSED',
    'PATROL_MISSED',
    'VISITOR_GATE_DENIED',
    'GEOFENCE',
    'INCIDENT',
  ];
  for (let i = 1; i <= N; i++) {
    const message = `[VOL-FA-${pad(i)}] Volume field alert ${pad(i)}`;
    const existing = await prisma.fieldAlert.findFirst({
      where: { organizationId: orgId, message },
    });
    const ack = i % 2 === 0;
    if (!existing) {
      await prisma.fieldAlert.create({
        data: {
          organizationId: orgId,
          siteId: sitePick(i),
          guardId: volGuardIds[(i - 1) % volGuardIds.length],
          alertType: alertTypes[(i - 1) % alertTypes.length]!,
          severity: i % 4 === 0 ? 'HIGH' : 'MEDIUM',
          message,
          acknowledged: ack,
          acknowledgedBy: ack ? ctx.supervisorUserId : null,
          escalationStage:
            i % 5 === 0 ? 'BOM' : i % 3 === 0 ? 'FIELD' : 'SUPERVISOR',
          createdAt: hoursAgo(i * 2),
        },
      });
    }
    bump('fieldAlerts');
  }

  // ── EOB OccurrenceEntry ~20 ────────────────────────────────────────────
  const eobCats = [
    'ROUTINE',
    'VISITOR_ISSUE',
    'PATROL',
    'INCIDENT',
    'EQUIPMENT',
    'OTHER',
  ];
  for (let i = 1; i <= N; i++) {
    const description = `[VOL-EOB-${pad(i)}] Volume occurrence — gate check ${pad(i)}`;
    const existing = await prisma.occurrenceEntry.findFirst({
      where: { organizationId: orgId, description, isCurrent: true },
    });
    if (!existing) {
      await prisma.occurrenceEntry.create({
        data: {
          organizationId: orgId,
          siteId: sitePick(i),
          officerId: ctx.supervisorUserId,
          category: eobCats[(i - 1) % eobCats.length]!,
          description,
          recordedAt: hoursAgo(i * 4),
          approvedBy: i % 3 === 0 ? ctx.opsUserId : null,
        },
      });
    }
    bump('eob');
  }

  // ── Checkpoints + PatrolScan ~20 ───────────────────────────────────────
  const volCheckpointIds: string[] = [];
  for (let i = 1; i <= N; i++) {
    const code = `VOL-CP-${pad(i)}`;
    const siteId = i % 2 === 0 ? ctx.siteOfficeId : ctx.siteWarehouseId;
    const cp = await prisma.checkpoint.upsert({
      where: {
        organizationId_siteId_code: {
          organizationId: orgId,
          siteId,
          code,
        },
      },
      update: { name: `Volume Checkpoint ${pad(i)}`, isActive: true },
      create: {
        organizationId: orgId,
        siteId,
        code,
        name: `Volume Checkpoint ${pad(i)}`,
        zone: i % 2 === 0 ? 'Perimeter' : 'Interior',
        qrCode: `QR-VOL-CP-${pad(i)}`,
      },
    });
    volCheckpointIds.push(cp.id);
    bump('checkpoints');
  }
  for (let i = 1; i <= N; i++) {
    const clientEventId = `vol-scan-${pad(i)}`;
    const existing = await prisma.patrolScan.findFirst({
      where: { clientEventId },
    });
    if (!existing) {
      const cpId = volCheckpointIds[i - 1]!;
      const cp = await prisma.checkpoint.findUniqueOrThrow({
        where: { id: cpId },
      });
      await prisma.patrolScan.create({
        data: {
          organizationId: orgId,
          guardId: volGuardIds[(i - 1) % volGuardIds.length]!,
          siteId: cp.siteId,
          checkpointId: cpId,
          scannedAt: hoursAgo(i * 2),
          method: i % 2 === 0 ? 'QR' : 'NFC',
          clientEventId,
          remarks: `[VOL-SCAN-${pad(i)}]`,
        },
      });
    }
    bump('patrolScans');
  }

  // ── Incidents VOL-INC-01..20 ───────────────────────────────────────────
  const incCats = [
    'SUSPICIOUS_ACTIVITY',
    'ACCESS_BREACH',
    'PROPERTY_DAMAGE',
    'THEFT',
    'MISCONDUCT',
    'SECURITY_BREACH',
  ];
  const incSev: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const incStat: IncidentStatus[] = [
    'OPEN',
    'INVESTIGATING',
    'RESOLVED',
    'CLOSED',
  ];
  for (let i = 1; i <= N; i++) {
    const incidentNumber = `VOL-INC-${pad(i)}`;
    const status = incStat[(i - 1) % incStat.length]!;
    await prisma.incident.upsert({
      where: {
        organizationId_incidentNumber: {
          organizationId: orgId,
          incidentNumber,
        },
      },
      update: {
        title: `Volume incident ${pad(i)}`,
        status,
        siteId: sitePick(i),
      },
      create: {
        organizationId: orgId,
        siteId: sitePick(i),
        incidentNumber,
        category: incCats[(i - 1) % incCats.length]!,
        severity: incSev[(i - 1) % incSev.length]!,
        status,
        title: `Volume incident ${pad(i)}`,
        description: `Seed volume incident ${pad(i)} for portal/branch lists.`,
        reporterId: ctx.supervisorUserId,
        resolvedAt:
          status === 'RESOLVED' || status === 'CLOSED' ? hoursAgo(i) : null,
        createdAt: hoursAgo(i * 6),
      },
    });
    bump('incidents');
  }

  // ── CustomerEmployee VOL-EMP-01..20 on CUST-DEMO ───────────────────────
  const depts = ['Logistics', 'HR', 'Finance', 'Production', 'IT', 'Security'];
  const levels: AccessLevel[] = ['STANDARD', 'RESTRICTED', 'ELEVATED'];
  for (let i = 1; i <= N; i++) {
    const email = `vol.emp.${pad(i)}@demo-mfg.co.tz`;
    await prisma.customerEmployee.upsert({
      where: {
        customerId_email: { customerId: ctx.customerId, email },
      },
      update: {
        fullName: `${FIRST[(i - 1) % FIRST.length]} Employee ${pad(i)}`,
        employeeNumber: `VOL-EMP-${pad(i)}`,
        isActive: i !== 18,
        accessLevel: levels[(i - 1) % levels.length]!,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        employeeNumber: `VOL-EMP-${pad(i)}`,
        fullName: `${FIRST[(i - 1) % FIRST.length]} Employee ${pad(i)}`,
        email,
        phone: `+2557558${pad(i, 4)}`,
        department: depts[(i - 1) % depts.length],
        accessLevel: levels[(i - 1) % levels.length]!,
        accessCardRef: `CARD-VOL-EMP-${pad(i)}`,
        isActive: i !== 18,
        createdBy: ctx.adminUserId,
      },
    });
    bump('customerEmployees');
  }

  // ── CustomerContact VOL-CTC-01..20 ─────────────────────────────────────
  const contactRoles: CustomerContactRole[] = [
    'GENERAL',
    'BILLING',
    'OPERATIONS',
    'SECURITY',
    'OTHER',
  ];
  for (let i = 1; i <= N; i++) {
    const email = `vol.ctc.${pad(i)}@demo-mfg.co.tz`;
    const existing = await prisma.customerContact.findFirst({
      where: {
        organizationId: orgId,
        customerId: ctx.customerId,
        email,
      },
    });
    if (!existing) {
      await prisma.customerContact.create({
        data: {
          organizationId: orgId,
          customerId: ctx.customerId,
          fullName: `${FIRST[(i - 1) % FIRST.length]} Contact ${pad(i)}`,
          designation: contactRoles[(i - 1) % contactRoles.length],
          role: contactRoles[(i - 1) % contactRoles.length]!,
          email,
          phone: `+2557557${pad(i, 4)}`,
          isPrimary: false,
          notes: `VOL-CTC-${pad(i)}`,
          createdBy: ctx.adminUserId,
        },
      });
    }
    bump('contacts');
  }

  // ── Complaints VOL-CMP-01..20 ──────────────────────────────────────────
  const cmpCats = [
    'SERVICE_QUALITY',
    'GUARD_CONDUCT',
    'BILLING',
    'ATTENDANCE',
    'SECURITY',
    'OTHER',
  ] as const;
  const cmpStat: ComplaintStatus[] = [
    'OPEN',
    'ACKNOWLEDGED',
    'UNDER_REVIEW',
    'RESOLVED',
    'CLOSED',
  ];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-CMP-${pad(i)}`;
    await prisma.customerComplaint.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: orgId,
          referenceNumber,
        },
      },
      update: {
        status: cmpStat[(i - 1) % cmpStat.length]!,
        title: `Volume complaint ${pad(i)}`,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        referenceNumber,
        category: cmpCats[(i - 1) % cmpCats.length]!,
        severity: i % 5 === 0 ? 'HIGH' : 'MEDIUM',
        status: cmpStat[(i - 1) % cmpStat.length]!,
        title: `Volume complaint ${pad(i)}`,
        description: `Seed complaint ${pad(i)} for customer/callcentre lists.`,
        siteId: sitePick(i),
        callbackPhone: '+255755000200',
        createdBy: ctx.portalUserId,
      },
    });
    bump('complaints');
  }

  // ── Service requests VOL-SR-01..20 ─────────────────────────────────────
  const srCats = [
    'EXTRA_GUARDS',
    'COVERAGE',
    'ACCESS',
    'VISITOR',
    'BILLING',
    'OTHER',
  ] as const;
  const srStat: ServiceRequestStatus[] = [
    'OPEN',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
  ];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-SR-${pad(i)}`;
    await prisma.customerServiceRequest.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: orgId,
          referenceNumber,
        },
      },
      update: {
        status: srStat[(i - 1) % srStat.length]!,
        title: `Volume service request ${pad(i)}`,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        referenceNumber,
        category: srCats[(i - 1) % srCats.length]!,
        urgency: i % 3 === 0 ? 'SAME_DAY' : 'THIS_WEEK',
        status: srStat[(i - 1) % srStat.length]!,
        title: `Volume service request ${pad(i)}`,
        description: `Seed SR ${pad(i)} for customer/callcentre inbox.`,
        siteId: sitePick(i),
        callbackPhone: '+255755000200',
        createdBy: ctx.portalUserId,
      },
    });
    bump('serviceRequests');
  }

  // ── Visitors VOL-VIS-01..20 + entries ──────────────────────────────────
  const apptStat: AppointmentStatus[] = [
    'PENDING',
    'APPROVED',
    'APPROVED',
    'COMPLETED',
    'REJECTED',
  ];
  const volApptIds: string[] = [];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-VIS-${pad(i)}`;
    const status = apptStat[(i - 1) % apptStat.length]!;
    const from = hoursAgo(status === 'COMPLETED' ? 48 + i : 2 - (i % 5));
    const until = new Date(from.getTime() + 6 * 3600_000);
    const row = await prisma.visitorAppointment.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: orgId,
          referenceNumber,
        },
      },
      update: {
        status,
        visitorName: `Volume Visitor ${pad(i)}`,
        siteId: sitePick(i),
        validFrom: from,
        validUntil: until,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        siteId: sitePick(i),
        gateId: ctx.gateMainId,
        referenceNumber,
        visitorName: `Volume Visitor ${pad(i)}`,
        visitorEmail: `vol.vis.${pad(i)}@example.com`,
        visitorPhone: `+2557128${pad(i, 4)}`,
        companyName: 'Volume Guest Co',
        purpose: `Volume visit purpose ${pad(i)}`,
        hostName: 'Jane Doe',
        hostUserId: ctx.portalUserId,
        idType: i % 2 === 0 ? 'NIDA' : null,
        idNumber: i % 2 === 0 ? `19900101${pad(i, 10)}` : null,
        validFrom: from,
        validUntil: until,
        status,
        approvedBy:
          status === 'APPROVED' || status === 'COMPLETED'
            ? ctx.adminUserId
            : null,
        approvedAt:
          status === 'APPROVED' || status === 'COMPLETED' ? from : null,
        rejectedReason:
          status === 'REJECTED' ? 'Host unavailable (volume seed)' : null,
        createdBy: ctx.adminUserId,
      },
    });
    volApptIds.push(row.id);
    bump('visitors');
  }

  for (let i = 1; i <= N; i++) {
    const clientEventId = `vol-ve-${pad(i)}`;
    const existing = await prisma.visitorEntry.findFirst({
      where: { clientEventId },
    });
    if (!existing) {
      const direction: VisitorEntryDirection = i % 2 === 0 ? 'OUT' : 'IN';
      const result: VerificationResult =
        i % 7 === 0 ? 'DENIED_INVALID' : 'ALLOWED';
      await prisma.visitorEntry.create({
        data: {
          organizationId: orgId,
          appointmentId:
            result === 'ALLOWED'
              ? volApptIds[(i - 1) % volApptIds.length]
              : null,
          siteId: sitePick(i),
          gateId: ctx.gateMainId,
          visitorName: `Volume Visitor ${pad(i)}`,
          result,
          direction,
          denyReason: result === 'ALLOWED' ? null : 'Volume seed deny',
          verifiedBy: ctx.adminUserId,
          clientEventId,
          recordedAt: hoursAgo(i),
        },
      });
    }
    bump('visitorEntries');
  }

  // ── Vehicles / permits / entries / violations / ANPR / blacklist ───────
  const vehTypes: VehicleType[] = ['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'];
  const permitTypes: PermitType[] = [
    'EMPLOYEE',
    'VISITOR',
    'CONTRACTOR',
    'RESERVED',
  ];
  const permitStatuses: PermitStatus[] = [
    'ACTIVE',
    'ACTIVE',
    'PENDING',
    'SUSPENDED',
    'EXPIRED',
  ];
  const volVehicleIds: string[] = [];
  const volPlates: string[] = [];
  const permitFrom = daysFromNow(-30);
  const permitUntil = daysFromNow(335);
  for (let i = 1; i <= N; i++) {
    const plateNumber = `VOL-PLT-${pad(i)}`;
    const veh = await prisma.vehicle.upsert({
      where: {
        organizationId_plateNumber: {
          organizationId: orgId,
          plateNumber,
        },
      },
      update: {
        customerId: ctx.customerId,
        isActive: true,
        rfidTagRef: `RFID-VOL-${pad(i)}`,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        plateNumber,
        vehicleType: vehTypes[(i - 1) % vehTypes.length]!,
        make: 'Toyota',
        model: `VolModel-${pad(i)}`,
        color: i % 2 === 0 ? 'White' : 'Silver',
        ownerName: `${FIRST[(i - 1) % FIRST.length]} Driver ${pad(i)}`,
        ownerPhone: `+2557556${pad(i, 4)}`,
        rfidTagRef: `RFID-VOL-${pad(i)}`,
        createdBy: ctx.adminUserId,
      },
    });
    volVehicleIds.push(veh.id);
    volPlates.push(plateNumber);
    bump('vehicles');

    const permitNumber = `VOL-PRM-${pad(i)}`;
    await prisma.parkingPermit.upsert({
      where: {
        organizationId_permitNumber: {
          organizationId: orgId,
          permitNumber,
        },
      },
      update: {
        vehicleId: veh.id,
        status: permitStatuses[(i - 1) % permitStatuses.length]!,
        siteId: sitePick(i),
      },
      create: {
        organizationId: orgId,
        vehicleId: veh.id,
        siteId: sitePick(i),
        permitNumber,
        permitType: permitTypes[(i - 1) % permitTypes.length]!,
        status: permitStatuses[(i - 1) % permitStatuses.length]!,
        validFrom: permitFrom,
        validUntil: permitUntil,
        feeAmount: 80_000 + i * 5_000,
        currency: 'TZS',
        createdBy: ctx.adminUserId,
      },
    });
    bump('permits');
  }

  for (let i = 1; i <= N; i++) {
    const clientEventId = `vol-pe-${pad(i)}`;
    const existing = await prisma.parkingEntry.findFirst({
      where: { clientEventId },
    });
    if (!existing) {
      const direction: ParkingEntryDirection = i % 2 === 0 ? 'EXIT' : 'ENTRY';
      const decision: ParkingDecision =
        i % 6 === 0 ? 'DENY' : i % 5 === 0 ? 'PENDING' : 'ALLOW';
      await prisma.parkingEntry.create({
        data: {
          organizationId: orgId,
          siteId: sitePick(i),
          gateId: ctx.gateMainId,
          vehicleId: volVehicleIds[i - 1],
          plateNumber: volPlates[i - 1]!,
          direction,
          decision,
          recordedBy: ctx.adminUserId,
          clientEventId,
          recordedAt: hoursAgo(i * 1.5),
        },
      });
    }
    bump('parkingEntries');
  }

  const vTypes: ViolationType[] = [
    'NO_PERMIT',
    'EXPIRED_PERMIT',
    'WRONG_ZONE',
    'OVERSTAY',
    'BLACKLISTED',
  ];
  for (let i = 1; i <= N; i++) {
    const description = `[VOL-PV-${pad(i)}] Volume parking violation`;
    const existing = await prisma.parkingViolation.findFirst({
      where: { organizationId: orgId, description },
    });
    if (!existing) {
      await prisma.parkingViolation.create({
        data: {
          organizationId: orgId,
          siteId: sitePick(i),
          plateNumber: volPlates[i - 1]!,
          vehicleId: volVehicleIds[i - 1],
          violationType: vTypes[(i - 1) % vTypes.length]!,
          description,
          recordedAt: hoursAgo(i * 3),
          createdBy: ctx.adminUserId,
        },
      });
    }
    bump('violations');
  }

  // Blacklist — VOL-BLK-01..20 (pads list without wiping existing demo plates)
  for (let i = 1; i <= N; i++) {
    const plateNumber = `VOL-BLK-${pad(i)}`;
    await prisma.vehicleBlacklist.upsert({
      where: {
        organizationId_plateNumber: { organizationId: orgId, plateNumber },
      },
      update: {
        reason: `Volume blacklist ${pad(i)}`,
        isActive: i % 5 !== 0,
      },
      create: {
        organizationId: orgId,
        plateNumber,
        reason: `Volume blacklist ${pad(i)}`,
        isActive: i % 5 !== 0,
        createdBy: ctx.adminUserId,
      },
    });
    bump('blacklist');
  }

  const decisions: ParkingDecision[] = ['PENDING', 'ALLOW', 'DENY'];
  for (let i = 1; i <= N; i++) {
    const seedKey = `VOL-ANPR-${pad(i)}`;
    const existing = await prisma.anprResult.findFirst({
      where: {
        organizationId: orgId,
        rawPayload: { path: ['seedKey'], equals: seedKey },
      },
    });
    const decision = decisions[(i - 1) % decisions.length]!;
    const capturedAt = hoursAgo(i);
    if (!existing) {
      await prisma.anprResult.create({
        data: {
          organizationId: orgId,
          siteId: sitePick(i),
          gateId: ctx.gateMainId,
          plateNumber: volPlates[i - 1]!,
          confidence: 0.7 + (i % 30) / 100,
          cameraId: 'CAM-PARK-01',
          decision,
          decidedBy: decision === 'PENDING' ? null : ctx.adminUserId,
          decidedAt: decision === 'PENDING' ? null : capturedAt,
          denyReason: decision === 'DENY' ? 'Volume seed deny' : null,
          capturedAt,
          rawPayload: { seedKey },
        },
      });
    }
    bump('anpr');
  }

  // ── Invoices VOL-INV-01..20 ────────────────────────────────────────────
  const invStatuses: InvoiceStatus[] = [
    'DRAFT',
    'SENT',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
  ];
  const invServices = [
    'SECURITY_GUARD',
    'CCTV_MONITORING',
    'ACCESS_CONTROL',
    'VISITOR_MANAGEMENT',
    'PARKING',
    'RECRUITMENT',
    'CUSTOMER_PAYROLL',
    'ALARM_RESPONSE',
    'TECHNICAL',
    'OTHER',
  ];
  for (let i = 1; i <= N; i++) {
    const invoiceNumber = `VOL-INV-${pad(i)}`;
    const total = 400_000 + i * 50_000;
    const status = invStatuses[(i - 1) % invStatuses.length]!;
    const serviceType = invServices[(i - 1) % invServices.length]!;
    const paid =
      status === 'PAID'
        ? total
        : status === 'PARTIALLY_PAID'
          ? Math.floor(total / 2)
          : 0;
    const issueDate = daysFromNow(-i * 2);
    const dueDate = daysFromNow(status === 'OVERDUE' ? -5 - i : 20 + i);
    await prisma.invoice.upsert({
      where: {
        organizationId_invoiceNumber: {
          organizationId: orgId,
          invoiceNumber,
        },
      },
      update: {
        status,
        totalAmount: total,
        subtotal: total,
        amountPaid: paid,
        customerId: ctx.customerId,
        contractId: ctx.contractGuardId ?? volContractIds[0] ?? null,
        serviceType,
      },
      create: {
        organizationId: orgId,
        customerId: ctx.customerId,
        contractId: ctx.contractGuardId ?? volContractIds[0] ?? null,
        invoiceNumber,
        issueDate,
        dueDate,
        subtotal: total,
        taxAmount: 0,
        totalAmount: total,
        amountPaid: paid,
        currency: 'TZS',
        status,
        serviceType,
        notes: `Volume seed invoice ${pad(i)}`,
        createdBy: ctx.adminUserId,
        lines: {
          create: [
            {
              description: `Volume services line ${pad(i)}`,
              quantity: 1,
              unitPrice: total,
              amount: total,
            },
          ],
        },
      },
    });
    bump('invoices');
  }

  // ── Petty cash vouchers ~20 ────────────────────────────────────────────
  let fund = await prisma.pettyCashFund.findFirst({
    where: { organizationId: orgId, name: 'HQ Petty Cash' },
  });
  if (!fund) {
    fund = await prisma.pettyCashFund.create({
      data: {
        organizationId: orgId,
        name: 'HQ Petty Cash',
        imprestAmount: 2_000_000,
        currentBalance: 2_000_000,
        custodianId: ctx.adminUserId,
        createdBy: ctx.adminUserId,
      },
    });
  }
  const pcStatuses: PettyCashVoucherStatus[] = [
    'PENDING',
    'APPROVED',
    'ISSUED',
    'REIMBURSED',
    'REJECTED',
  ];
  for (let i = 1; i <= N; i++) {
    const voucherNumber = `VOL-PCV-${pad(i)}`;
    const status = pcStatuses[(i - 1) % pcStatuses.length]!;
    await prisma.pettyCashVoucher.upsert({
      where: {
        organizationId_voucherNumber: {
          organizationId: orgId,
          voucherNumber,
        },
      },
      update: {
        status,
        amount: 25_000 + i * 1_000,
        department: 'Operations',
        branchId: ctx.branchId ?? null,
      },
      create: {
        organizationId: orgId,
        fundId: fund.id,
        voucherNumber,
        amount: 25_000 + i * 1_000,
        purpose: `Volume petty cash ${pad(i)}`,
        category: i % 2 === 0 ? 'TRANSPORT' : 'SUPPLIES',
        status,
        department: 'Operations',
        branchId: ctx.branchId ?? null,
        approvedBy:
          status === 'APPROVED' ||
          status === 'ISSUED' ||
          status === 'REIMBURSED'
            ? ctx.adminUserId
            : null,
        issuedBy:
          status === 'ISSUED' || status === 'REIMBURSED'
            ? ctx.adminUserId
            : null,
        issuedAt:
          status === 'ISSUED' || status === 'REIMBURSED' ? hoursAgo(i) : null,
        reimbursedAt: status === 'REIMBURSED' ? hoursAgo(i) : null,
        createdBy: ctx.supervisorUserId,
      },
    });
    bump('pettyCash');
  }

  // ── Assets VOL-AST-01..20 ──────────────────────────────────────────────
  const assetCats = ['RADIO', 'TORCH', 'UNIFORM', 'BOOTS', 'PHONE', 'BATON'];
  const assetStatuses: AssetStatus[] = [
    'AVAILABLE',
    'ASSIGNED',
    'MAINTENANCE',
    'AVAILABLE',
    'DISPOSED',
  ];
  for (let i = 1; i <= N; i++) {
    const assetTag = `VOL-AST-${pad(i)}`;
    await prisma.asset.upsert({
      where: {
        organizationId_assetTag: { organizationId: orgId, assetTag },
      },
      update: {
        name: `Volume ${assetCats[(i - 1) % assetCats.length]} ${pad(i)}`,
        status: assetStatuses[(i - 1) % assetStatuses.length]!,
      },
      create: {
        organizationId: orgId,
        assetTag,
        name: `Volume ${assetCats[(i - 1) % assetCats.length]} ${pad(i)}`,
        category: assetCats[(i - 1) % assetCats.length],
        purchaseCost: 50_000 + i * 10_000,
        purchaseDate: daysFromNow(-200 - i),
        serialNumber: `SN-VOL-${pad(i)}`,
        status: assetStatuses[(i - 1) % assetStatuses.length]!,
        createdBy: ctx.adminUserId,
      },
    });
    bump('assets');
  }

  // ── Employee loans VOL-LOAN-01..20 ─────────────────────────────────────
  const employees = await prisma.employee.findMany({
    where: { organizationId: orgId },
    select: { id: true },
    take: 40,
  });
  const loanStatuses: LoanStatus[] = [
    'PENDING_APPROVAL',
    'APPROVED',
    'ACTIVE',
    'COMPLETED',
    'REJECTED',
  ];
  for (let i = 1; i <= N; i++) {
    const loanNumber = `VOL-LOAN-${pad(i)}`;
    const emp = employees[(i - 1) % Math.max(employees.length, 1)];
    if (!emp) break;
    const principal = 100_000 + i * 25_000;
    const term = 3 + (i % 6);
    await prisma.employeeLoan.upsert({
      where: {
        organizationId_loanNumber: { organizationId: orgId, loanNumber },
      },
      update: {
        status: loanStatuses[(i - 1) % loanStatuses.length]!,
        employeeId: emp.id,
      },
      create: {
        organizationId: orgId,
        employeeId: emp.id,
        loanNumber,
        principalAmount: principal,
        interestRate: 0,
        termMonths: term,
        monthlyInstallment: Math.round(principal / term),
        status: loanStatuses[(i - 1) % loanStatuses.length]!,
        purpose: i % 2 === 0 ? 'BOOTS' : 'UNIFORM',
        createdBy: ctx.adminUserId,
      },
    });
    bump('loans');
  }

  // ── Devices VOL-DEV-01..20 ─────────────────────────────────────────────
  const deviceTypes: DeviceType[] = [
    'FINGERPRINT_SCANNER',
    'FACE_TERMINAL',
    'RFID_READER',
    'QR_SCANNER',
    'CCTV_CAMERA',
    'PRINTER',
    'BIOMETRIC_TERMINAL',
    'SMART_CARD_READER',
  ];
  const deviceConn: DeviceConnection[] = [
    'NETWORK',
    'MQTT',
    'ONVIF',
    'USB',
    'SERIAL',
  ];
  const deviceStat: DeviceStatus[] = ['ONLINE', 'OFFLINE', 'PENDING', 'DISABLED'];
  for (let i = 1; i <= N; i++) {
    const code = `VOL-DEV-${pad(i)}`;
    const type = deviceTypes[(i - 1) % deviceTypes.length]!;
    await prisma.device.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      update: {
        name: `Volume ${type} ${pad(i)}`,
        status: deviceStat[(i - 1) % deviceStat.length]!,
        siteId: sitePick(i),
      },
      create: {
        organizationId: orgId,
        siteId: sitePick(i),
        type,
        connection:
          type === 'CCTV_CAMERA'
            ? 'ONVIF'
            : deviceConn[(i - 1) % deviceConn.length]!,
        code,
        name: `Volume ${type} ${pad(i)}`,
        vendor: i % 2 === 0 ? 'ZKTeco' : 'Hikvision',
        model: `VOL-M${pad(i)}`,
        status: deviceStat[(i - 1) % deviceStat.length]!,
        config:
          type === 'CCTV_CAMERA'
            ? { zone: 'Volume', gridOrder: i, streamUrl: '' }
            : undefined,
        createdBy: ctx.adminUserId,
      },
    });
    bump('devices');
  }

  // ── Job postings + applications (~20 real-looking OPEN roles) ──────────
  const careerRoles: Array<{
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string;
  }> = [
    {
      title: 'Security Guard — Warehouse Night Shift',
      department: 'Operations',
      location: 'Dar es Salaam',
      description:
        'Protect client warehouse premises overnight. Patrol, access control, and incident reporting via the HIGHLINK guard app.',
      requirements:
        'Valid guard licence, physical fitness, smartphone, basic English/Swahili',
    },
    {
      title: 'Site Supervisor — Industrial Clients',
      department: 'Operations',
      location: 'Dar es Salaam',
      description:
        'Lead a team of guards across industrial sites. Verify attendance, escalate field alerts, and brief Branch Ops.',
      requirements:
        '2+ years supervisory experience, driver licence preferred, radio protocol',
    },
    {
      title: 'Gate Officer — Visitor & Vehicle Control',
      department: 'Access Control',
      location: 'Dar es Salaam',
      description:
        'Verify visitor codes, staff cards, and parking permits at main gates. Deny invalid entries and log outcomes.',
      requirements:
        'Customer service mindset, attention to detail, smartphone or tablet literacy',
    },
    {
      title: 'CCTV Monitoring Officer',
      department: 'Control Room',
      location: 'Dar es Salaam HQ',
      description:
        'Monitor camera walls, triage AI/ANPR alerts, and escalate incidents to Field Officers and Branch Ops.',
      requirements:
        'Prior CCTV experience preferred, calm under pressure, shift flexibility',
    },
    {
      title: 'Field Officer — Branch Coverage',
      department: 'Branch Operations',
      location: 'Dar es Salaam / Coast',
      description:
        'Inspect sites, verify alertness, support replacements, and escalate missed patrols or attendance gaps.',
      requirements:
        'Operations background, motorcycle/car licence, strong reporting skills',
    },
    {
      title: 'Control Room Dispatcher',
      department: 'Control Room',
      location: 'Dar es Salaam HQ',
      description:
        'Coordinate field alerts, radio traffic, and escalation stages from Supervisor through BOM to Control.',
      requirements:
        'Clear communication, multi-tasking, willingness to work rotating shifts',
    },
    {
      title: 'HR Officer — Guard Onboarding',
      department: 'Human Resources',
      location: 'Dar es Salaam HQ',
      description:
        'Screen applicants, schedule interviews, and support onboarding of guards into PSSMS workforce records.',
      requirements:
        'HR diploma or equivalent, organised filing, confidentiality',
    },
    {
      title: 'Payroll Assistant',
      department: 'Payroll',
      location: 'Dar es Salaam HQ',
      description:
        'Support payroll cycles, attendance inputs, and payslip distribution under Payroll Officer guidance.',
      requirements:
        'Basic accounting, Excel literacy, attention to statutory deductions',
    },
    {
      title: 'Procurement Storekeeper',
      department: 'Procurement',
      location: 'DSM Stores',
      description:
        'Receive uniforms and equipment, confirm asset returns, and keep stock movements accurate.',
      requirements:
        'Inventory experience, integrity, basic computer skills',
    },
    {
      title: 'Accounts Officer — Supplier Payments',
      department: 'Finance',
      location: 'Dar es Salaam HQ',
      description:
        'Process supplier invoices linked to purchase orders and support payment voucher workflows.',
      requirements:
        'Accounting diploma, Tally/Excel, familiarity with approvals',
    },
    {
      title: 'Call Centre Support Agent',
      department: 'Customer Support',
      location: 'Dar es Salaam HQ',
      description:
        'Handle customer complaints and service tickets, escalate visitor issues, and update Call Centre queues.',
      requirements:
        'Clear phone etiquette, Swahili + English, CRM comfort',
    },
    {
      title: 'IT Support Technician',
      department: 'ICT',
      location: 'Dar es Salaam HQ',
      description:
        'Support portal users, password resets (via approval where required), and device registry hygiene.',
      requirements:
        'IT certificate, helpdesk experience, security awareness',
    },
    {
      title: 'Driver — Operations Pool',
      department: 'Operations',
      location: 'Dar es Salaam',
      description:
        'Transport supervisors and equipment between sites. Maintain vehicle logs and fuel accountability.',
      requirements:
        'Valid Class C licence, clean record, knowledge of DSM routes',
    },
    {
      title: 'Dog Handler — K9 Unit',
      department: 'Operations',
      location: 'Dar es Salaam',
      description:
        'Deploy with trained dogs for high-risk site patrols and event coverage under Field Officer direction.',
      requirements:
        'K9 handling experience or willingness to train, physical fitness',
    },
    {
      title: 'Firearms-Authorised Guard',
      department: 'Operations',
      location: 'Dar es Salaam',
      description:
        'Armed posts at high-value client sites. Strict adherence to firearm readiness and site SOPs.',
      requirements:
        'Current firearm authorisation, clean background, advanced guard licence',
    },
    {
      title: 'Female Security Guard — Corporate Offices',
      department: 'Operations',
      location: 'Dar es Salaam CBD',
      description:
        'Day-shift coverage for corporate lobbies, visitor escort, and access desk support.',
      requirements:
        'Guard licence, professional presentation, customer service',
    },
    {
      title: 'Training Instructor — Guard Academy',
      department: 'Training',
      location: 'Dar es Salaam',
      description:
        'Deliver induction and refresher training on attendance, alertness, and occurrence book standards.',
      requirements:
        'Training or senior guard background, facilitation skills',
    },
    {
      title: 'Compliance Assistant',
      department: 'Compliance',
      location: 'Dar es Salaam HQ',
      description:
        'Support policy registers, audit evidence packs, and DPO breach documentation under Compliance Officer.',
      requirements:
        'Attention to detail, document control, confidentiality',
    },
    {
      title: 'Marketing & BD Associate',
      department: 'Marketing',
      location: 'Dar es Salaam',
      description:
        'Support customer surveys, quote follow-ups, and pipeline tracking for security service contracts.',
      requirements:
        'Sales or marketing diploma, CRM tools, driving licence a plus',
    },
    {
      title: 'Intern — Administration',
      department: 'Administration',
      location: 'Dar es Salaam HQ',
      description:
        'Assist branch records, filing, and office coordination for a 3–6 month internship.',
      requirements:
        'Diploma student or recent graduate, MS Office, reliable attendance',
    },
  ];
  let posting = await prisma.jobPosting.findFirst({
    where: { organizationId: orgId, status: 'OPEN' },
    orderBy: { createdAt: 'asc' },
  });
  for (let i = 1; i <= careerRoles.length; i++) {
    const role = careerRoles[i - 1]!;
    const id = `00000000-0000-4000-8000-0000000003${pad(i)}`;
    const closesAt = daysFromNow(30 + i);
    const row = await prisma.jobPosting.upsert({
      where: { id },
      update: {
        status: 'OPEN',
        title: role.title,
        department: role.department,
        location: role.location,
        description: role.description,
        requirements: role.requirements,
        publishedAt: new Date(),
        closesAt,
      },
      create: {
        id,
        organizationId: orgId,
        title: role.title,
        department: role.department,
        location: role.location,
        description: role.description,
        requirements: role.requirements,
        status: 'OPEN',
        publishedAt: new Date(),
        closesAt,
        createdBy: ctx.adminUserId,
      },
    });
    if (!posting) posting = row;
    bump('jobPostings');
  }
  if (!posting) {
    posting = await prisma.jobPosting.create({
      data: {
        organizationId: orgId,
        title: 'Security Guard — Multi-site',
        department: 'Operations',
        location: 'Dar es Salaam',
        description: 'Protect client sites under HIGHLINK deployment.',
        requirements: 'Valid guard licence',
        status: 'OPEN',
        publishedAt: new Date(),
        createdBy: ctx.adminUserId,
      },
    });
  }
  const appStatuses: ApplicationStatus[] = [
    'SUBMITTED',
    'SCREENING',
    'INTERVIEW',
    'OFFERED',
    'HIRED',
    'REJECTED',
  ];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-APP-${pad(i)}`;
    await prisma.jobApplication.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: orgId,
          referenceNumber,
        },
      },
      update: {
        status: appStatuses[(i - 1) % appStatuses.length]!,
        applicantName: `${FIRST[(i - 1) % FIRST.length]} Applicant ${pad(i)}`,
      },
      create: {
        organizationId: orgId,
        postingId: posting.id,
        applicantName: `${FIRST[(i - 1) % FIRST.length]} Applicant ${pad(i)}`,
        email: `vol.app.${pad(i)}@example.com`,
        phone: `+2557138${pad(i, 4)}`,
        coverLetter: `Volume application ${pad(i)}`,
        status: appStatuses[(i - 1) % appStatuses.length]!,
        referenceNumber,
      },
    });
    bump('applications');
  }

  // ── Leave requests ~20 ─────────────────────────────────────────────────
  let leaveType = await prisma.leaveType.findFirst({
    where: { organizationId: orgId, code: 'ANNUAL' },
  });
  if (!leaveType) {
    leaveType = await prisma.leaveType.create({
      data: {
        organizationId: orgId,
        code: 'ANNUAL',
        name: 'Annual Leave',
        annualQuotaDays: 21,
      },
    });
  }
  const leaveStatuses: LeaveRequestStatus[] = [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
  ];
  for (let i = 1; i <= N; i++) {
    const reason = `[VOL-LR-${pad(i)}] Volume leave request`;
    const emp = employees[(i - 1) % Math.max(employees.length, 1)];
    if (!emp) break;
    const existing = await prisma.leaveRequest.findFirst({
      where: { organizationId: orgId, reason },
    });
    if (!existing) {
      const start = daysFromNow(i);
      const end = daysFromNow(i + 2);
      await prisma.leaveRequest.create({
        data: {
          organizationId: orgId,
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          startDate: start,
          endDate: end,
          days: 3,
          reason,
          status: leaveStatuses[(i - 1) % leaveStatuses.length]!,
          createdBy: ctx.adminUserId,
        },
      });
    }
    bump('leaveRequests');
  }

  // ── Compliance policies / breaches — pad toward 20 ─────────────────────
  const polStatuses: PolicyStatus[] = [
    'DRAFT',
    'PENDING_APPROVAL',
    'PUBLISHED',
    'ARCHIVED',
  ];
  for (let i = 1; i <= N; i++) {
    const code = `VOL-POL-${pad(i)}`;
    await prisma.policyDocument.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      update: {
        title: `Volume policy ${pad(i)}`,
        status: polStatuses[(i - 1) % polStatuses.length]!,
      },
      create: {
        organizationId: orgId,
        code,
        title: `Volume policy ${pad(i)}`,
        category: i % 2 === 0 ? 'DATA_PROTECTION' : 'SECURITY',
        summary: `Volume seed policy ${pad(i)}`,
        body: `Body for volume policy ${pad(i)}.`,
        status: polStatuses[(i - 1) % polStatuses.length]!,
        createdBy: ctx.adminUserId,
        publishedAt:
          polStatuses[(i - 1) % polStatuses.length] === 'PUBLISHED'
            ? new Date()
            : null,
        publishedBy:
          polStatuses[(i - 1) % polStatuses.length] === 'PUBLISHED'
            ? ctx.adminUserId
            : null,
      },
    });
    bump('policies');
  }
  const breachStatuses: BreachStatus[] = [
    'REPORTED',
    'INVESTIGATING',
    'CONTAINED',
    'CLOSED',
  ];
  const breachSev: BreachSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  for (let i = 1; i <= N; i++) {
    const referenceCode = `VOL-BRCH-${pad(i)}`;
    await prisma.dataBreachCase.upsert({
      where: {
        organizationId_referenceCode: {
          organizationId: orgId,
          referenceCode,
        },
      },
      update: {
        title: `Volume breach ${pad(i)}`,
        status: breachStatuses[(i - 1) % breachStatuses.length]!,
      },
      create: {
        organizationId: orgId,
        referenceCode,
        title: `Volume breach ${pad(i)}`,
        description: `Seed DPO breach case ${pad(i)}.`,
        severity: breachSev[(i - 1) % breachSev.length]!,
        status: breachStatuses[(i - 1) % breachStatuses.length]!,
        discoveredAt: daysAgo(i * 2),
        affectedDataCategories: 'Contact details',
        estimatedRecords: 10 * i,
        createdBy: ctx.adminUserId,
      },
    });
    bump('breaches');
  }

  // ── B2B GuardSupplyRequest pad ─────────────────────────────────────────
  let partner = await prisma.b2bSecurityPartner.findFirst({
    where: { organizationId: orgId, code: 'OSC-DEMO' },
  });
  if (!partner) {
    partner = await prisma.b2bSecurityPartner.create({
      data: {
        organizationId: orgId,
        code: 'OSC-DEMO',
        name: 'Demo Other Security Co',
        status: 'APPROVED',
        createdBy: ctx.adminUserId,
      },
    });
  }
  const gsrStatuses: GuardSupplyRequestStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
  ];
  for (let i = 1; i <= N; i++) {
    const referenceNumber = `VOL-GSR-${pad(i)}`;
    await prisma.guardSupplyRequest.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: orgId,
          referenceNumber,
        },
      },
      update: {
        status: gsrStatuses[(i - 1) % gsrStatuses.length]!,
        guardCount: 5 + i,
      },
      create: {
        organizationId: orgId,
        partnerId: partner.id,
        referenceNumber,
        guardCount: 5 + i,
        siteLocation: `Volume site zone ${pad(i)}`,
        startDate: daysFromNow(30 + i),
        endDate: daysFromNow(120 + i),
        criteriaNotes: `Volume B2B criteria ${pad(i)}`,
        status: gsrStatuses[(i - 1) % gsrStatuses.length]!,
        createdBy: ctx.adminUserId,
      },
    });
    bump('b2bRequests');
  }

  // ── Audit gaps: verification codes, gateways, docs, approvals, payroll ─
  // Gate codes for APPROVED/COMPLETED VOL visitors (scannable demo: VOLCODE01..)
  const approvedVol = await prisma.visitorAppointment.findMany({
    where: {
      organizationId: orgId,
      referenceNumber: { startsWith: 'VOL-VIS-' },
      status: { in: ['APPROVED', 'COMPLETED'] },
    },
    select: { id: true, siteId: true, gateId: true, validFrom: true, validUntil: true },
    take: N,
  });
  for (let i = 0; i < approvedVol.length; i++) {
    const appt = approvedVol[i]!;
    const existingCode = await prisma.verificationCode.findFirst({
      where: { appointmentId: appt.id },
      select: { id: true },
    });
    if (!existingCode) {
      const plain = `VOLCODE${pad(i + 1)}`;
      await prisma.verificationCode.create({
        data: {
          appointmentId: appt.id,
          codeHash: hashGateCode(plain),
          maxUses: 1,
          useCount: appt.validUntil < new Date() ? 1 : 0,
          usedAt: appt.validUntil < new Date() ? appt.validFrom : null,
          validFrom: appt.validFrom,
          validUntil: appt.validUntil,
          siteId: appt.siteId,
          gateId: appt.gateId ?? ctx.gateMainId,
        },
      });
    }
    bump('verificationCodes');
  }

  // Edge gateways VOL-GW-01..20
  for (let i = 1; i <= N; i++) {
    const code = `VOL-GW-${pad(i)}`;
    await prisma.edgeGateway.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      update: {
        name: `Volume gateway ${pad(i)}`,
        status: i % 3 === 0 ? 'OFFLINE' : 'ONLINE',
        lastHeartbeatAt: hoursAgo(i % 8),
      },
      create: {
        organizationId: orgId,
        siteId: sitePick(i),
        code,
        name: `Volume gateway ${pad(i)}`,
        apiKeyHash: apiKeyHash(`vol-gw-key-${pad(i)}`),
        version: '1.0.0',
        ipAddress: `10.20.0.${i}`,
        status: i % 3 === 0 ? 'OFFLINE' : 'ONLINE',
        lastHeartbeatAt: hoursAgo(i % 8),
        createdBy: ctx.adminUserId,
      },
    });
    bump('gateways');
  }

  // DocumentObject metadata (lists/presign UI) — no MinIO binary required
  const docParents = [
    ...volApptIds.slice(0, 10).map((id) => ({
      resourceType: 'VisitorAppointment',
      resourceId: id,
    })),
    ...(
      await prisma.occurrenceEntry.findMany({
        where: {
          organizationId: orgId,
          description: { startsWith: '[VOL-EOB-' },
        },
        select: { id: true },
        take: 10,
      })
    ).map((e) => ({ resourceType: 'OccurrenceEntry', resourceId: e.id })),
  ];
  for (let i = 0; i < Math.min(N, docParents.length); i++) {
    const parent = docParents[i]!;
    const objectKey = `vol/${parent.resourceType.toLowerCase()}/${parent.resourceId}/${pad(i + 1)}.pdf`;
    const existing = await prisma.documentObject.findFirst({
      where: { bucket: 'pssms-documents', objectKey },
      select: { id: true },
    });
    if (!existing) {
      await prisma.documentObject.create({
        data: {
          organizationId: orgId,
          bucket: 'pssms-documents',
          objectKey,
          fileName: `VOL-DOC-${pad(i + 1)}.pdf`,
          contentType: 'application/pdf',
          sizeBytes: 1024 * (i + 1),
          resourceType: parent.resourceType,
          resourceId: parent.resourceId,
          uploadedBy: ctx.adminUserId,
          checksum: apiKeyHash(objectKey),
        },
      });
    }
    bump('documents');
  }

  // Pending approval instances (leave-approval workflow) — fills /approvals queue
  const leaveWf = await prisma.workflowDefinition.findFirst({
    where: { code: 'leave-approval' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const leaveVersionId = leaveWf?.versions[0]?.id;
  const leaveRows = await prisma.leaveRequest.findMany({
    where: {
      organizationId: orgId,
      reason: { startsWith: '[VOL-LR-' },
    },
    select: { id: true, status: true },
    take: N,
  });
  if (leaveVersionId) {
    for (let i = 0; i < leaveRows.length; i++) {
      const leave = leaveRows[i]!;
      const existing = await prisma.approvalInstance.findFirst({
        where: {
          organizationId: orgId,
          resourceType: 'LeaveRequest',
          resourceId: leave.id,
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.approvalInstance.create({
          data: {
            versionId: leaveVersionId,
            organizationId: orgId,
            resourceType: 'LeaveRequest',
            resourceId: leave.id,
            status:
              leave.status === 'APPROVED'
                ? 'APPROVED'
                : leave.status === 'REJECTED'
                  ? 'REJECTED'
                  : leave.status === 'CANCELLED'
                    ? 'CANCELLED'
                    : 'PENDING',
            currentStepOrder: leave.status === 'PENDING' ? 1 : 4,
            createdBy: ctx.adminUserId, // ≠ supervisor approver (SoD)
          },
        });
      }
      bump('approvals');
    }
  }

  // Payroll cycles VOL-PAY-01..20 (+ one payslip each when employee exists)
  const ruleVersion = await prisma.payrollRuleVersion.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  const payrollEmp = await prisma.employee.findFirst({
    where: { organizationId: orgId, employeeNumber: 'GRD-0001' },
    select: { id: true, employeeNumber: true, fullName: true },
  });
  if (ruleVersion) {
    const payStatuses = [
      'DRAFT',
      'CALCULATED',
      'PENDING_APPROVAL',
      'APPROVED',
      'PAID',
    ] as const;
    for (let i = 1; i <= N; i++) {
      const cycleCode = `VOL-PAY-${pad(i)}`;
      const periodStart = new Date(
        Date.UTC(2026, (i - 1) % 12, 1, 0, 0, 0),
      );
      const periodEnd = new Date(
        Date.UTC(2026, (i - 1) % 12 + 1, 0, 0, 0, 0),
      );
      const status = payStatuses[(i - 1) % payStatuses.length]!;
      const cycle = await prisma.payrollCycle.upsert({
        where: {
          organizationId_cycleCode: { organizationId: orgId, cycleCode },
        },
        update: { status },
        create: {
          organizationId: orgId,
          tenantType: 'INTERNAL_COMPANY',
          cycleCode,
          periodStart,
          periodEnd,
          status,
          ruleVersionId: ruleVersion.id,
          createdBy: ctx.adminUserId,
          paidAt: status === 'PAID' ? periodEnd : null,
          paymentReference: status === 'PAID' ? `VOL-PAYREF-${pad(i)}` : null,
        },
      });
      if (payrollEmp) {
        const slipExists = await prisma.payslipSnapshot.findFirst({
          where: { cycleId: cycle.id, employeeId: payrollEmp.id },
          select: { id: true },
        });
        if (!slipExists) {
          const gross = 850000;
          const ded = 127500;
          await prisma.payslipSnapshot.create({
            data: {
              organizationId: orgId,
              cycleId: cycle.id,
              employeeId: payrollEmp.id,
              employeeNumber: payrollEmp.employeeNumber,
              employeeName: payrollEmp.fullName,
              inputsSnapshot: { seed: true, vol: i },
              allowancesSnapshot: { housing: 0 },
              deductionsSnapshot: { paye: ded },
              calculationResult: { net: gross - ded },
              grossPay: gross,
              totalDeductions: ded,
              netPay: gross - ded,
              ruleVersionId: ruleVersion.id,
              createdBy: ctx.adminUserId,
            },
          });
        }
      }
      bump('payrollCycles');
    }
  }

  // ── Summary (org totals for VOL-* where applicable) ────────────────────
  const summary = {
    customersVol: await prisma.customer.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-CUST-' } },
    }),
    sitesVol: await prisma.site.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-SITE-' } },
    }),
    contractsVol: await prisma.contract.count({
      where: {
        organizationId: orgId,
        contractNumber: { startsWith: 'VOL-CTR-' },
      },
    }),
    guardsVol: await prisma.guardProfile.count({
      where: {
        organizationId: orgId,
        employeeNumber: { startsWith: 'VOL-GRD-' },
      },
    }),
    deploymentsVolGuards: await prisma.guardDeployment.count({
      where: {
        organizationId: orgId,
        guard: { employeeNumber: { startsWith: 'VOL-GRD-' } },
      },
    }),
    shiftsVol: await prisma.shift.count({
      where: { organizationId: orgId, name: { startsWith: 'VOL-SHF-' } },
    }),
    attendanceVol: await prisma.guardAttendance.count({
      where: { clientEventId: { startsWith: 'vol-att-' } },
    }),
    alertnessVol: await prisma.alertnessCheck.count({
      where: { referenceNumber: { startsWith: 'VOL-ALT-' } },
    }),
    fieldAlertsVol: await prisma.fieldAlert.count({
      where: { organizationId: orgId, message: { startsWith: '[VOL-FA-' } },
    }),
    eobVol: await prisma.occurrenceEntry.count({
      where: {
        organizationId: orgId,
        description: { startsWith: '[VOL-EOB-' },
      },
    }),
    checkpointsVol: await prisma.checkpoint.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-CP-' } },
    }),
    patrolScansVol: await prisma.patrolScan.count({
      where: { clientEventId: { startsWith: 'vol-scan-' } },
    }),
    incidentsVol: await prisma.incident.count({
      where: {
        organizationId: orgId,
        incidentNumber: { startsWith: 'VOL-INC-' },
      },
    }),
    customerEmployeesVol: await prisma.customerEmployee.count({
      where: {
        customerId: ctx.customerId,
        employeeNumber: { startsWith: 'VOL-EMP-' },
      },
    }),
    contactsVol: await prisma.customerContact.count({
      where: {
        organizationId: orgId,
        customerId: ctx.customerId,
        email: { startsWith: 'vol.ctc.' },
      },
    }),
    complaintsVol: await prisma.customerComplaint.count({
      where: {
        organizationId: orgId,
        referenceNumber: { startsWith: 'VOL-CMP-' },
      },
    }),
    serviceRequestsVol: await prisma.customerServiceRequest.count({
      where: {
        organizationId: orgId,
        referenceNumber: { startsWith: 'VOL-SR-' },
      },
    }),
    visitorsVol: await prisma.visitorAppointment.count({
      where: {
        organizationId: orgId,
        referenceNumber: { startsWith: 'VOL-VIS-' },
      },
    }),
    visitorEntriesVol: await prisma.visitorEntry.count({
      where: { clientEventId: { startsWith: 'vol-ve-' } },
    }),
    vehiclesVol: await prisma.vehicle.count({
      where: {
        organizationId: orgId,
        plateNumber: { startsWith: 'VOL-PLT-' },
      },
    }),
    permitsVol: await prisma.parkingPermit.count({
      where: {
        organizationId: orgId,
        permitNumber: { startsWith: 'VOL-PRM-' },
      },
    }),
    parkingEntriesVol: await prisma.parkingEntry.count({
      where: { clientEventId: { startsWith: 'vol-pe-' } },
    }),
    violationsVol: await prisma.parkingViolation.count({
      where: {
        organizationId: orgId,
        description: { startsWith: '[VOL-PV-' },
      },
    }),
    blacklistVol: await prisma.vehicleBlacklist.count({
      where: {
        organizationId: orgId,
        plateNumber: { startsWith: 'VOL-BLK-' },
      },
    }),
    anprVol: await prisma.anprResult.count({
      where: {
        organizationId: orgId,
        plateNumber: { startsWith: 'VOL-PLT-' },
      },
    }),
    invoicesVol: await prisma.invoice.count({
      where: {
        organizationId: orgId,
        invoiceNumber: { startsWith: 'VOL-INV-' },
      },
    }),
    pettyCashVol: await prisma.pettyCashVoucher.count({
      where: {
        organizationId: orgId,
        voucherNumber: { startsWith: 'VOL-PCV-' },
      },
    }),
    assetsVol: await prisma.asset.count({
      where: { organizationId: orgId, assetTag: { startsWith: 'VOL-AST-' } },
    }),
    loansVol: await prisma.employeeLoan.count({
      where: {
        organizationId: orgId,
        loanNumber: { startsWith: 'VOL-LOAN-' },
      },
    }),
    devicesVol: await prisma.device.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-DEV-' } },
    }),
    applicationsVol: await prisma.jobApplication.count({
      where: {
        organizationId: orgId,
        referenceNumber: { startsWith: 'VOL-APP-' },
      },
    }),
    leaveVol: await prisma.leaveRequest.count({
      where: { organizationId: orgId, reason: { startsWith: '[VOL-LR-' } },
    }),
    policiesVol: await prisma.policyDocument.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-POL-' } },
    }),
    breachesVol: await prisma.dataBreachCase.count({
      where: {
        organizationId: orgId,
        referenceCode: { startsWith: 'VOL-BRCH-' },
      },
    }),
    b2bVol: await prisma.guardSupplyRequest.count({
      where: {
        organizationId: orgId,
        referenceNumber: { startsWith: 'VOL-GSR-' },
      },
    }),
    verificationCodesVol: await prisma.verificationCode.count({
      where: {
        appointment: {
          organizationId: orgId,
          referenceNumber: { startsWith: 'VOL-VIS-' },
        },
      },
    }),
    gatewaysVol: await prisma.edgeGateway.count({
      where: { organizationId: orgId, code: { startsWith: 'VOL-GW-' } },
    }),
    documentsVol: await prisma.documentObject.count({
      where: {
        organizationId: orgId,
        objectKey: { startsWith: 'vol/' },
      },
    }),
    approvalsVol: await prisma.approvalInstance.count({
      where: {
        organizationId: orgId,
        resourceType: 'LeaveRequest',
      },
    }),
    payrollCyclesVol: await prisma.payrollCycle.count({
      where: {
        organizationId: orgId,
        cycleCode: { startsWith: 'VOL-PAY-' },
      },
    }),
  };

  console.log('Demo volume seed summary (VOL-* counts):');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k}: ${v}`);
  }
  void counts;
}
