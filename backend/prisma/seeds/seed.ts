import { PrismaClient, ContractStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { code: 'HIGHLINK' },
    update: {},
    create: {
      code: 'HIGHLINK',
      name: 'Highlink Investigation and Security Guard Company Limited',
      email: 'info@highlink.co.tz',
      phone: '+255700000000',
    },
  });

  const permissions = [
    { code: 'users.manage', name: 'Manage users', module: 'identity' },
    { code: 'enterprise.manage', name: 'Manage enterprise data', module: 'enterprise' },
    { code: 'customers.manage', name: 'Manage customers', module: 'customers' },
    { code: 'contracts.manage', name: 'Manage contracts', module: 'contracts' },
    { code: 'approvals.act', name: 'Act on approvals', module: 'approvals' },
    { code: 'audit.read', name: 'Read audit logs', module: 'audit' },
    { code: 'guards.manage', name: 'Manage guards', module: 'workforce' },
    { code: 'operations.manage', name: 'Manage operations', module: 'operations' },
    { code: 'attendance.manage', name: 'Manage attendance', module: 'attendance' },
    { code: 'incidents.manage', name: 'Manage incidents', module: 'incidents' },
    { code: 'access.manage', name: 'Manage customer access', module: 'access-control' },
    { code: 'visitors.manage', name: 'Manage visitors', module: 'visitors' },
    { code: 'parking.manage', name: 'Manage parking', module: 'parking' },
    { code: 'hr.manage', name: 'Manage HR', module: 'workforce' },
    {
      code: 'ess.access',
      name: 'Employee self-service portal',
      module: 'workforce',
    },
    { code: 'recruitment.manage', name: 'Manage recruitment', module: 'recruitment' },
    { code: 'payroll.manage', name: 'Manage payroll', module: 'payroll' },
    { code: 'loans.manage', name: 'Manage employee loans', module: 'employee-loans' },
    { code: 'finance.manage', name: 'Manage finance', module: 'finance' },
    { code: 'procurement.manage', name: 'Manage procurement', module: 'procurement' },
    { code: 'inventory.manage', name: 'Manage inventory', module: 'inventory' },
    { code: 'assets.manage', name: 'Manage assets', module: 'assets' },
    { code: 'notifications.manage', name: 'Manage notifications', module: 'notifications' },
    { code: 'reporting.read', name: 'Read executive reports', module: 'reporting' },
    {
      code: 'integrations.manage',
      name: 'Manage integrations & developer portal',
      module: 'integrations',
    },
    {
      code: 'compliance.manage',
      name: 'Manage compliance policies & breach register',
      module: 'compliance',
    },
    {
      code: 'documents.manage',
      name: 'Upload and read document attachments (MinIO)',
      module: 'documents',
    },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  const allPerms = await prisma.permission.findMany();

  const roleDefs = [
    { code: 'SUPER_ADMIN', name: 'Super Administrator', isSystem: true },
    { code: 'GENERAL_MANAGER', name: 'General Manager', isSystem: true },
    { code: 'HR_OFFICER', name: 'HR Officer', isSystem: true },
    { code: 'GUARD', name: 'Security Guard', isSystem: true },
    { code: 'GATE_OFFICER', name: 'Gate Officer', isSystem: true },
    { code: 'PARKING_OFFICER', name: 'Parking Officer', isSystem: true },
    { code: 'SUPERVISOR', name: 'Site Supervisor', isSystem: true },
    { code: 'CUSTOMER_PORTAL', name: 'Customer Portal User', isSystem: true },
    { code: 'SUPPLIER_PORTAL', name: 'Supplier Portal User', isSystem: true },
    {
      code: 'DEVELOPER',
      name: 'Developer / ICT Integrator',
      isSystem: true,
    },
    {
      code: 'COMPLIANCE_OFFICER',
      name: 'Compliance / DPO Officer',
      isSystem: true,
    },
    {
      code: 'LEGAL',
      name: 'Legal Officer',
      isSystem: true,
    },
    {
      code: 'CEO',
      name: 'Chief Executive Officer',
      isSystem: true,
    },
    {
      code: 'CMD',
      name: 'Chairman / Managing Director',
      isSystem: true,
    },
    {
      code: 'MARKETING',
      name: 'Marketing / Business Development',
      isSystem: true,
    },
  ];

  const portalPermCodes = new Set([
    'contracts.manage',
    'finance.manage',
    'visitors.manage',
    'access.manage',
    'parking.manage',
  ]);

  const supplierPortalPermCodes = new Set(['procurement.manage']);

  const gateOfficerPermCodes = new Set([
    'visitors.manage',
    'access.manage',
    'enterprise.manage', // sites/gates for duty context (not attendance/payroll)
  ]);

  const parkingOfficerPermCodes = new Set([
    'parking.manage',
    'enterprise.manage',
  ]);

  const supervisorPermCodes = new Set([
    'operations.manage',
    'attendance.manage',
    'incidents.manage',
    'enterprise.manage',
    'ess.access',
    'documents.manage',
  ]);

  const guardPermCodes = new Set([
    'ess.access',
    'attendance.manage',
    'operations.manage',
    'incidents.manage',
    'documents.manage',
  ]);

  // devices.manage does not exist — operations.manage covers /devices portal access
  const developerPermCodes = new Set([
    'integrations.manage',
    'users.manage',
    'audit.read',
    'notifications.manage',
    'operations.manage',
  ]);

  const complianceOfficerPermCodes = new Set([
    'compliance.manage',
    'audit.read',
    'approvals.act',
  ]);

  /** Contract approvers (Legal / CEO / CMD) — + reporting for Executive portal 35.2. */
  const contractApproverPermCodes = new Set([
    'contracts.manage',
    'approvals.act',
    'audit.read',
    'customers.manage',
    'reporting.read',
  ]);

  const marketingPermCodes = new Set([
    'contracts.manage',
    'customers.manage',
    'documents.manage',
  ]);

  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: r.code },
      },
      update: {},
      create: {
        organizationId: org.id,
        code: r.code,
        name: r.name,
        isSystem: r.isSystem,
      },
    });

    const permsForRole =
      r.code === 'CUSTOMER_PORTAL'
        ? allPerms.filter((p) => portalPermCodes.has(p.code))
        : r.code === 'SUPPLIER_PORTAL'
          ? allPerms.filter((p) => supplierPortalPermCodes.has(p.code))
          : r.code === 'GATE_OFFICER'
            ? allPerms.filter((p) => gateOfficerPermCodes.has(p.code))
            : r.code === 'PARKING_OFFICER'
              ? allPerms.filter((p) => parkingOfficerPermCodes.has(p.code))
              : r.code === 'SUPERVISOR'
                ? allPerms.filter((p) => supervisorPermCodes.has(p.code))
                : r.code === 'GUARD'
                  ? allPerms.filter((p) => guardPermCodes.has(p.code))
                  : r.code === 'DEVELOPER'
                    ? allPerms.filter((p) => developerPermCodes.has(p.code))
                    : r.code === 'COMPLIANCE_OFFICER'
                      ? allPerms.filter((p) =>
                          complianceOfficerPermCodes.has(p.code),
                        )
                      : r.code === 'LEGAL' ||
                          r.code === 'CEO' ||
                          r.code === 'CMD'
                        ? allPerms.filter((p) =>
                            contractApproverPermCodes.has(p.code),
                          )
                        : r.code === 'MARKETING'
                          ? allPerms.filter((p) =>
                              marketingPermCodes.has(p.code),
                            )
                          : allPerms;

    for (const perm of permsForRole) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }

    // Keep restricted roles honest on re-seed (drop stale grants).
    if (
      [
        'GUARD',
        'SUPERVISOR',
        'GATE_OFFICER',
        'PARKING_OFFICER',
        'DEVELOPER',
        'COMPLIANCE_OFFICER',
        'LEGAL',
        'CEO',
        'CMD',
        'MARKETING',
        'CUSTOMER_PORTAL',
        'SUPPLIER_PORTAL',
      ].includes(r.code)
    ) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: { notIn: permsForRole.map((p) => p.id) },
        },
      });
    }
  }

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'SUPER_ADMIN' },
  });
  const gmRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'GENERAL_MANAGER' },
  });
  const guardRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'GUARD' },
  });
  const gateOfficerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'GATE_OFFICER' },
  });
  const parkingOfficerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'PARKING_OFFICER' },
  });
  const supervisorRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'SUPERVISOR' },
  });
  const complianceOfficerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'COMPLIANCE_OFFICER' },
  });
  const legalRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'LEGAL' },
  });
  const ceoRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'CEO' },
  });
  const cmdRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'CMD' },
  });
  const marketingRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'MARKETING' },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@highlink.co.tz' },
    update: {},
    create: {
      email: 'admin@highlink.co.tz',
      fullName: 'System Administrator',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: superAdminRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'gm@highlink.co.tz' },
    update: {},
    create: {
      email: 'gm@highlink.co.tz',
      fullName: 'General Manager',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: gmRole.id }] },
    },
  });

  const guardUser = await prisma.user.upsert({
    where: { email: 'guard1@highlink.co.tz' },
    update: {},
    create: {
      email: 'guard1@highlink.co.tz',
      fullName: 'John Guard',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: guardRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'gate1@highlink.co.tz' },
    update: {},
    create: {
      email: 'gate1@highlink.co.tz',
      fullName: 'Grace Gate',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: gateOfficerRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'parking1@highlink.co.tz' },
    update: {},
    create: {
      email: 'parking1@highlink.co.tz',
      fullName: 'Paula Parking',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: parkingOfficerRole.id }] },
    },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'supervisor1@highlink.co.tz' },
    update: {},
    create: {
      email: 'supervisor1@highlink.co.tz',
      fullName: 'Sam Supervisor',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: supervisorRole.id }] },
    },
  });

  const complianceUser = await prisma.user.upsert({
    where: { email: 'compliance1@highlink.co.tz' },
    update: {},
    create: {
      email: 'compliance1@highlink.co.tz',
      fullName: 'Clara Compliance',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: complianceOfficerRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'legal1@highlink.co.tz' },
    update: {},
    create: {
      email: 'legal1@highlink.co.tz',
      fullName: 'Laura Legal',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: legalRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'ceo@highlink.co.tz' },
    update: {},
    create: {
      email: 'ceo@highlink.co.tz',
      fullName: 'Charles Executive',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: ceoRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'cmd@highlink.co.tz' },
    update: {},
    create: {
      email: 'cmd@highlink.co.tz',
      fullName: 'Catherine Managing Director',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: cmdRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'marketing1@highlink.co.tz' },
    update: {},
    create: {
      email: 'marketing1@highlink.co.tz',
      fullName: 'Mark Marketing',
      passwordHash,
      organizationId: org.id,
      roles: { create: [{ roleId: marketingRole.id }] },
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'DSM-HQ' },
    },
    update: {},
    create: {
      organizationId: org.id,
      code: 'DSM-HQ',
      name: 'Dar es Salaam HQ',
      region: 'Dar es Salaam',
      createdBy: admin.id,
    },
  });

  await prisma.department.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'OPS' },
    },
    update: {},
    create: {
      organizationId: org.id,
      branchId: branch.id,
      code: 'OPS',
      name: 'Operations',
    },
  });

  const site = await prisma.site.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'SITE-WAREHOUSE-A' },
    },
    update: {
      latitude: -6.7924,
      longitude: 39.2083,
    },
    create: {
      organizationId: org.id,
      branchId: branch.id,
      code: 'SITE-WAREHOUSE-A',
      name: 'Warehouse A — Industrial Area',
      address: 'Dar es Salaam Industrial Area',
      latitude: -6.7924,
      longitude: 39.2083,
      createdBy: admin.id,
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'CUST-DEMO' },
    },
    update: {
      name: 'Demo Manufacturing Ltd',
      tradingName: 'Demo Mfg',
      tin: '100-111-222',
      vrn: '40-111222-A',
      email: 'security@demo-mfg.co.tz',
      billingEmail: 'billing@demo-mfg.co.tz',
      phone: '+255755000001',
      address: 'Plot 45, Industrial Area, Dar es Salaam',
      city: 'Dar es Salaam',
      region: 'Dar es Salaam',
      country: 'Tanzania',
      contactPerson: 'Jane Doe',
      contactDesignation: 'Security Manager',
      category: 'INDUSTRIAL',
      industry: 'Manufacturing',
      ranking: 'IMPORTANT',
      status: 'ACTIVE',
      serviceTypes: ['GUARD', 'CCTV', 'VISITOR', 'PARKING'],
      slaLevel: 'PREMIUM',
      paymentTerms: 'NET_30',
      paymentMethod: 'BANK_TRANSFER',
      currency: 'TZS',
      invoiceFrequency: 'MONTHLY',
    },
    create: {
      organizationId: org.id,
      code: 'CUST-DEMO',
      name: 'Demo Manufacturing Ltd',
      tradingName: 'Demo Mfg',
      tin: '100-111-222',
      vrn: '40-111222-A',
      email: 'security@demo-mfg.co.tz',
      billingEmail: 'billing@demo-mfg.co.tz',
      phone: '+255755000001',
      address: 'Plot 45, Industrial Area, Dar es Salaam',
      city: 'Dar es Salaam',
      region: 'Dar es Salaam',
      country: 'Tanzania',
      contactPerson: 'Jane Doe',
      contactDesignation: 'Security Manager',
      category: 'INDUSTRIAL',
      industry: 'Manufacturing',
      ranking: 'IMPORTANT',
      status: 'ACTIVE',
      serviceTypes: ['GUARD', 'CCTV', 'VISITOR', 'PARKING'],
      slaLevel: 'PREMIUM',
      paymentTerms: 'NET_30',
      paymentMethod: 'BANK_TRANSFER',
      currency: 'TZS',
      invoiceFrequency: 'MONTHLY',
      createdBy: admin.id,
    },
  });

  await prisma.site.update({
    where: { id: site.id },
    data: { customerId: customer.id },
  });

  const gate = await prisma.gate.upsert({
    where: {
      organizationId_siteId_code: {
        organizationId: org.id,
        siteId: site.id,
        code: 'GATE-MAIN',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      siteId: site.id,
      code: 'GATE-MAIN',
      name: 'Main Gate',
      gateType: 'MIXED',
      createdBy: admin.id,
    },
  });

  const vehicleGate = await prisma.gate.upsert({
    where: {
      organizationId_siteId_code: {
        organizationId: org.id,
        siteId: site.id,
        code: 'GATE-VEHICLE',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      siteId: site.id,
      code: 'GATE-VEHICLE',
      name: 'Vehicle Gate',
      gateType: 'VEHICLE',
      createdBy: admin.id,
    },
  });

  const customerEmployee = await prisma.customerEmployee.upsert({
    where: {
      customerId_email: {
        customerId: customer.id,
        email: 'jane.doe@demo-mfg.co.tz',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      customerId: customer.id,
      employeeNumber: 'EMP-1001',
      fullName: 'Jane Doe',
      email: 'jane.doe@demo-mfg.co.tz',
      phone: '+255755000100',
      department: 'Logistics',
      accessCardRef: 'CARD-EMP-1001',
      createdBy: admin.id,
    },
  });

  const portalRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'CUSTOMER_PORTAL' },
  });

  const portalUser = await prisma.user.upsert({
    where: { email: 'portal@demo-mfg.co.tz' },
    update: { customerId: customer.id },
    create: {
      email: 'portal@demo-mfg.co.tz',
      fullName: 'Demo Manufacturing Portal',
      passwordHash,
      organizationId: org.id,
      customerId: customer.id,
      roles: { create: [{ roleId: portalRole.id }] },
    },
  });

  const existingSr = await prisma.customerServiceRequest.findFirst({
    where: {
      organizationId: org.id,
      referenceNumber: 'SR-00001',
    },
  });
  if (!existingSr) {
    await prisma.customerServiceRequest.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        referenceNumber: 'SR-00001',
        category: 'COVERAGE',
        urgency: 'SAME_DAY',
        status: 'OPEN',
        title: 'Demo: Extra coverage on night shift',
        description:
          'Warehouse A needs one additional guard on the night shift this week due to inventory stocktake. Callback the site supervisor.',
        siteId: site.id,
        callbackPhone: '+255755000200',
        createdBy: portalUser.id,
      },
    });
  }

  const vehicle = await prisma.vehicle.upsert({
    where: {
      organizationId_plateNumber: {
        organizationId: org.id,
        plateNumber: 'T123ABC',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      customerId: customer.id,
      plateNumber: 'T123ABC',
      vehicleType: 'CAR',
      make: 'Toyota',
      model: 'Corolla',
      color: 'White',
      ownerName: 'Jane Doe',
      ownerPhone: '+255755000100',
      createdBy: admin.id,
    },
  });

  const permitValidFrom = new Date();
  const permitValidUntil = new Date();
  permitValidUntil.setFullYear(permitValidUntil.getFullYear() + 1);

  await prisma.parkingPermit.upsert({
    where: {
      organizationId_permitNumber: {
        organizationId: org.id,
        permitNumber: 'PRM-DEMO-001',
      },
    },
    update: {
      status: 'ACTIVE',
      validFrom: permitValidFrom,
      validUntil: permitValidUntil,
    },
    create: {
      organizationId: org.id,
      vehicleId: vehicle.id,
      siteId: site.id,
      permitNumber: 'PRM-DEMO-001',
      permitType: 'EMPLOYEE',
      status: 'ACTIVE',
      validFrom: permitValidFrom,
      validUntil: permitValidUntil,
      createdBy: admin.id,
    },
  });

  // ── Rich CUST-DEMO data for Customer Portal UI showcase ──
  const siteOffice = await prisma.site.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'SITE-OFFICE-DEMO' },
    },
    update: {
      customerId: customer.id,
      name: 'Demo HQ Offices',
      address: 'Samora Avenue, Dar es Salaam',
      isActive: true,
    },
    create: {
      organizationId: org.id,
      branchId: branch.id,
      customerId: customer.id,
      code: 'SITE-OFFICE-DEMO',
      name: 'Demo HQ Offices',
      address: 'Samora Avenue, Dar es Salaam',
      latitude: -6.8161,
      longitude: 39.2803,
      createdBy: admin.id,
    },
  });

  const contractSeeds: {
    contractNumber: string;
    title: string;
    serviceType: string;
    serviceTypes: string[];
    status: ContractStatus;
    monthlyFee: number;
    guardCount: number;
    startOffsetDays: number;
    endOffsetDays: number;
    sla: string;
    paymentTerms: string;
    contractKind?: string;
    noticePeriodDays?: number;
    invoiceFrequency?: string;
    vatApplicable?: boolean;
    slaLevel?: string;
    renewalDaysBeforeEnd?: number;
  }[] = [
    {
      contractNumber: 'CTR-DEMO-GUARD-2026',
      title: 'Armed & unarmed guard deployment — Warehouse A',
      serviceType: 'SECURITY_GUARD',
      serviceTypes: ['SECURITY_GUARD'],
      status: ContractStatus.ACTIVE,
      monthlyFee: 4_800_000,
      guardCount: 12,
      startOffsetDays: -120,
      endOffsetDays: 245,
      sla: '95% post coverage · response ≤ 30 min',
      paymentTerms: 'NET_30',
      contractKind: 'NEW',
      noticePeriodDays: 30,
      invoiceFrequency: 'MONTHLY',
      vatApplicable: true,
      slaLevel: 'STANDARD',
      renewalDaysBeforeEnd: 90,
    },
    {
      contractNumber: 'CTR-DEMO-CCTV-2026',
      title: 'CCTV monitoring & AI alerts — Warehouse + HQ',
      serviceType: 'CCTV_MONITORING',
      serviceTypes: ['CCTV_MONITORING'],
      status: ContractStatus.ACTIVE,
      monthlyFee: 1_850_000,
      guardCount: 0,
      startOffsetDays: -90,
      endOffsetDays: 40,
      sla: 'Camera uptime ≥ 99% · alert ack ≤ 5 min',
      paymentTerms: 'NET_30',
    },
    {
      contractNumber: 'CTR-DEMO-VISITOR-2026',
      title: 'Visitor appointment & gate verification',
      serviceType: 'VISITOR_MANAGEMENT',
      serviceTypes: ['VISITOR_MANAGEMENT'],
      status: ContractStatus.ACTIVE,
      monthlyFee: 650_000,
      guardCount: 0,
      startOffsetDays: -60,
      endOffsetDays: 305,
      sla: 'Code issuance ≤ 2 min · gate verify ≤ 30 sec',
      paymentTerms: 'NET_45',
    },
    {
      contractNumber: 'CTR-DEMO-PARK-2026',
      title: 'Parking permits & ANPR gate control',
      serviceType: 'PARKING',
      serviceTypes: ['PARKING'],
      status: ContractStatus.EXPIRING,
      monthlyFee: 420_000,
      guardCount: 0,
      startOffsetDays: -300,
      endOffsetDays: 25,
      sla: 'Permit activation same day · blacklist sync hourly',
      paymentTerms: 'ON_INVOICE',
    },
    {
      contractNumber: 'CTR-DEMO-ACCESS-DRAFT',
      title: 'Customer employee access control — expansion',
      serviceType: 'ACCESS_CONTROL',
      serviceTypes: ['ACCESS_CONTROL', 'VISITOR_MANAGEMENT'],
      status: ContractStatus.DRAFT,
      monthlyFee: 980_000,
      guardCount: 0,
      startOffsetDays: 14,
      endOffsetDays: 379,
      sla: 'Draft — pending commercial approval',
      paymentTerms: 'NET_30',
    },
  ];

  for (const c of contractSeeds) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + c.startOffsetDays);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + c.endOffsetDays);
    end.setUTCHours(0, 0, 0, 0);
    let renewalDate: Date | null = null;
    if (c.renewalDaysBeforeEnd != null) {
      renewalDate = new Date(end);
      renewalDate.setUTCDate(renewalDate.getUTCDate() - c.renewalDaysBeforeEnd);
      renewalDate.setUTCHours(0, 0, 0, 0);
    }
    const commercialFields = {
      contractKind: c.contractKind ?? 'NEW',
      noticePeriodDays: c.noticePeriodDays ?? 30,
      invoiceFrequency: c.invoiceFrequency ?? 'MONTHLY',
      vatApplicable: c.vatApplicable ?? true,
      slaLevel: c.slaLevel ?? 'STANDARD',
      renewalDate,
    };
    await prisma.contract.upsert({
      where: {
        organizationId_contractNumber: {
          organizationId: org.id,
          contractNumber: c.contractNumber,
        },
      },
      update: {
        title: c.title,
        serviceType: c.serviceType,
        serviceTypes: c.serviceTypes,
        status: c.status,
        startDate: start,
        endDate: end,
        monthlyFee: c.monthlyFee,
        guardCount: c.guardCount,
        slaTerms: c.sla,
        currency: 'TZS',
        paymentTerms: c.paymentTerms,
        ...commercialFields,
      },
      create: {
        organizationId: org.id,
        customerId: customer.id,
        contractNumber: c.contractNumber,
        title: c.title,
        serviceType: c.serviceType,
        serviceTypes: c.serviceTypes,
        status: c.status,
        startDate: start,
        endDate: end,
        monthlyFee: c.monthlyFee,
        currency: 'TZS',
        paymentTerms: c.paymentTerms,
        guardCount: c.guardCount,
        slaTerms: c.sla,
        createdBy: admin.id,
        ...commercialFields,
      },
    });
  }

  // B2: Contract ↔ Sites — link CUST-DEMO contracts to warehouse / office sites
  const demoContracts = await prisma.contract.findMany({
    where: {
      organizationId: org.id,
      customerId: customer.id,
      contractNumber: {
        in: [
          'CTR-DEMO-GUARD-2026',
          'CTR-DEMO-CCTV-2026',
          'CTR-DEMO-VISITOR-2026',
          'CTR-DEMO-PARK-2026',
          'CTR-DEMO-ACCESS-DRAFT',
        ],
      },
    },
    select: { id: true, contractNumber: true },
  });
  const contractIdByNumber = Object.fromEntries(
    demoContracts.map((c) => [c.contractNumber, c.id]),
  );
  const contractSiteLinks: Array<{ contractNumber: string; siteId: string }> =
    [];
  for (const num of [
    'CTR-DEMO-GUARD-2026',
    'CTR-DEMO-CCTV-2026',
    'CTR-DEMO-VISITOR-2026',
    'CTR-DEMO-PARK-2026',
  ] as const) {
    if (contractIdByNumber[num]) {
      contractSiteLinks.push({
        contractNumber: num,
        siteId: site.id,
      });
    }
  }
  for (const num of [
    'CTR-DEMO-CCTV-2026',
    'CTR-DEMO-ACCESS-DRAFT',
  ] as const) {
    if (contractIdByNumber[num]) {
      contractSiteLinks.push({
        contractNumber: num,
        siteId: siteOffice.id,
      });
    }
  }
  for (const link of contractSiteLinks) {
    const contractId = contractIdByNumber[link.contractNumber];
    if (!contractId) continue;
    await prisma.contractSite.upsert({
      where: {
        contractId_siteId: {
          contractId,
          siteId: link.siteId,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        contractId,
        siteId: link.siteId,
      },
    });
  }

  const staffSeeds = [
    {
      email: 'jane.doe@demo-mfg.co.tz',
      employeeNumber: 'EMP-1001',
      fullName: 'Jane Doe',
      phone: '+255755000100',
      department: 'Logistics',
      accessCardRef: 'CARD-EMP-1001',
    },
    {
      email: 'peter.mwangi@demo-mfg.co.tz',
      employeeNumber: 'EMP-1002',
      fullName: 'Peter Mwangi',
      phone: '+255755000101',
      department: 'Security Office',
      accessCardRef: 'CARD-EMP-1002',
    },
    {
      email: 'aisha.hassan@demo-mfg.co.tz',
      employeeNumber: 'EMP-1003',
      fullName: 'Aisha Hassan',
      phone: '+255755000102',
      department: 'Finance',
      accessCardRef: 'CARD-EMP-1003',
    },
    {
      email: 'joseph.kim@demo-mfg.co.tz',
      employeeNumber: 'EMP-1004',
      fullName: 'Joseph Kimaro',
      phone: '+255755000103',
      department: 'Operations',
      accessCardRef: 'CARD-EMP-1004',
    },
    {
      email: 'grace.nelly@demo-mfg.co.tz',
      employeeNumber: 'EMP-1005',
      fullName: 'Grace Nelly',
      phone: '+255755000104',
      department: 'HR',
      accessCardRef: 'CARD-EMP-1005',
    },
  ];
  for (const s of staffSeeds) {
    await prisma.customerEmployee.upsert({
      where: {
        customerId_email: { customerId: customer.id, email: s.email },
      },
      update: {
        fullName: s.fullName,
        phone: s.phone,
        department: s.department,
        accessCardRef: s.accessCardRef,
        employeeNumber: s.employeeNumber,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        customerId: customer.id,
        ...s,
        createdBy: admin.id,
      },
    });
  }

  // Demo access check-in/out for Customer Portal Staff access page
  const demoAccessStaff = await prisma.customerEmployee.findMany({
    where: { customerId: customer.id, organizationId: org.id },
    orderBy: { employeeNumber: 'asc' },
    take: 4,
  });
  const existingAccessDemo = await prisma.accessEntry.findFirst({
    where: {
      organizationId: org.id,
      customerId: customer.id,
      clientEventId: 'seed-access-demo-jane-in',
    },
  });
  if (!existingAccessDemo && demoAccessStaff.length > 0) {
    const nowAccess = new Date();
    const events: {
      employeeId: string;
      entryType: 'CHECK_IN' | 'CHECK_OUT';
      method: 'CARD' | 'QR' | 'BIOMETRIC';
      hoursAgo: number;
      clientEventId: string;
    }[] = [
      {
        employeeId: demoAccessStaff[0]!.id,
        entryType: 'CHECK_IN',
        method: 'CARD',
        hoursAgo: 2,
        clientEventId: 'seed-access-demo-jane-in',
      },
      {
        employeeId: demoAccessStaff[1]?.id ?? demoAccessStaff[0]!.id,
        entryType: 'CHECK_IN',
        method: 'QR',
        hoursAgo: 3,
        clientEventId: 'seed-access-demo-peter-in',
      },
      {
        employeeId: demoAccessStaff[2]?.id ?? demoAccessStaff[0]!.id,
        entryType: 'CHECK_OUT',
        method: 'CARD',
        hoursAgo: 5,
        clientEventId: 'seed-access-demo-aisha-out',
      },
      {
        employeeId: demoAccessStaff[3]?.id ?? demoAccessStaff[0]!.id,
        entryType: 'CHECK_IN',
        method: 'BIOMETRIC',
        hoursAgo: 1,
        clientEventId: 'seed-access-demo-joseph-in',
      },
    ];
    for (const ev of events) {
      await prisma.accessEntry.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          employeeId: ev.employeeId,
          siteId: site.id,
          gateId: gate.id,
          entryType: ev.entryType,
          accessMethod: ev.method,
          recordedBy: admin.id,
          clientEventId: ev.clientEventId,
          recordedAt: new Date(nowAccess.getTime() - ev.hoursAgo * 3600_000),
        },
      });
    }
  }

  // Parking demo fleet: 10 of each type (CAR / MOTORCYCLE / TRUCK / BUS) for parking-web UI
  type SeedVehType = 'CAR' | 'MOTORCYCLE' | 'TRUCK' | 'BUS';
  type SeedPermitType = 'EMPLOYEE' | 'VISITOR' | 'CONTRACTOR' | 'RESERVED';
  const carMakes = [
    ['Toyota', 'Corolla'],
    ['Nissan', 'X-Trail'],
    ['Honda', 'Fit'],
    ['Suzuki', 'Swift'],
    ['Mazda', 'Demio'],
    ['Hyundai', 'i10'],
    ['Toyota', 'Rav4'],
    ['Volkswagen', 'Polo'],
    ['Ford', 'EcoSport'],
    ['Kia', 'Picanto'],
  ] as const;
  const motoMakes = [
    ['Bajaj', 'Boxer'],
    ['TVS', 'Star'],
    ['Honda', 'Ace'],
    ['Yamaha', 'YBR'],
    ['Suzuki', 'Hayate'],
    ['Bajaj', 'Pulsar'],
    ['Hero', 'Splendor'],
    ['Honda', 'CB125'],
    ['TVS', 'Apache'],
    ['Yamaha', 'Crux'],
  ] as const;
  const truckMakes = [
    ['Isuzu', 'NPR'],
    ['Mitsubishi', 'Canter'],
    ['Toyota', 'Dyna'],
    ['Isuzu', 'FSR'],
    ['Hino', '300'],
    ['FAW', 'Tiger'],
    ['Isuzu', 'NQR'],
    ['Mitsubishi', 'Fuso'],
    ['Sinotruk', 'Howo'],
    ['Tata', 'Ultra'],
  ] as const;
  const busMakes = [
    ['Toyota', 'Coaster'],
    ['Yutong', 'ZK'],
    ['Higer', 'H8'],
    ['Scania', 'K-series'],
    ['Golden Dragon', 'XML'],
    ['Isuzu', 'NQR Bus'],
    ['Volvo', 'B7R'],
    ['King Long', 'XMQ'],
    ['Marcopolo', 'Torino'],
    ['Ashok', 'Leyland'],
  ] as const;
  const owners = [
    'Jane Doe',
    'Peter Mwangi',
    'Aisha Hassan',
    'John Kimaro',
    'Grace Mushi',
    'Demo Manufacturing Fleet',
    'Samuel Okello',
    'Fatuma Ally',
    'David Nyerere',
    'Maria Joseph',
  ];
  const colors = [
    'White',
    'Silver',
    'Black',
    'Blue',
    'Red',
    'Grey',
    'Green',
    'Yellow',
    'Orange',
    'Brown',
  ];

  const vehicleSeeds: {
    plate: string;
    type: SeedVehType;
    make: string;
    model: string;
    color: string;
    owner: string;
    phone: string;
    permit: string;
    permitType: SeedPermitType;
    siteId: string;
  }[] = [
    // Keep classic demo plates first (customer portal / e2e)
    {
      plate: 'T123ABC',
      type: 'CAR',
      make: 'Toyota',
      model: 'Corolla',
      color: 'White',
      owner: 'Jane Doe',
      phone: '+255755000100',
      permit: 'PRM-DEMO-001',
      permitType: 'EMPLOYEE',
      siteId: site.id,
    },
    {
      plate: 'T456DEF',
      type: 'CAR',
      make: 'Nissan',
      model: 'X-Trail',
      color: 'Silver',
      owner: 'Peter Mwangi',
      phone: '+255755000101',
      permit: 'PRM-DEMO-002',
      permitType: 'EMPLOYEE',
      siteId: site.id,
    },
    {
      plate: 'T789GHI',
      type: 'TRUCK',
      make: 'Isuzu',
      model: 'NPR',
      color: 'Blue',
      owner: 'Demo Manufacturing Fleet',
      phone: '+255755000001',
      permit: 'PRM-DEMO-003',
      permitType: 'CONTRACTOR',
      siteId: site.id,
    },
    {
      plate: 'T321JKL',
      type: 'MOTORCYCLE',
      make: 'Bajaj',
      model: 'Boxer',
      color: 'Black',
      owner: 'Aisha Hassan',
      phone: '+255755000102',
      permit: 'PRM-DEMO-004',
      permitType: 'EMPLOYEE',
      siteId: siteOffice.id,
    },
  ];

  const pushFleet = (
    type: SeedVehType,
    makes: readonly (readonly [string, string])[],
    platePrefix: string,
    permitPrefix: string,
    permitType: SeedPermitType,
    startIndex: number,
  ) => {
    for (let i = 0; i < 10; i++) {
      const n = i + 1;
      const plate =
        type === 'CAR' && n <= 2
          ? vehicleSeeds[n - 1]!.plate // already seeded classic cars
          : type === 'TRUCK' && n === 1
            ? 'T789GHI'
            : type === 'MOTORCYCLE' && n === 1
              ? 'T321JKL'
              : `${platePrefix}${String(n).padStart(2, '0')}`;
      const permit =
        type === 'CAR' && n <= 2
          ? `PRM-DEMO-00${n}`
          : type === 'TRUCK' && n === 1
            ? 'PRM-DEMO-003'
            : type === 'MOTORCYCLE' && n === 1
              ? 'PRM-DEMO-004'
              : `${permitPrefix}${String(n).padStart(2, '0')}`;
      // Skip duplicates already in vehicleSeeds (classic 4)
      if (vehicleSeeds.some((v) => v.plate === plate)) continue;
      const [make, model] = makes[i]!;
      vehicleSeeds.push({
        plate,
        type,
        make,
        model,
        color: colors[i]!,
        owner: owners[i]!,
        phone: `+25575501${platePrefix.slice(-2)}${String(n).padStart(2, '0')}`.slice(0, 13),
        permit,
        permitType,
        siteId: n % 2 === 0 ? siteOffice.id : site.id,
      });
    }
  };

  pushFleet('CAR', carMakes, 'T1CAR', 'PRM-CAR-', 'EMPLOYEE', 0);
  pushFleet('MOTORCYCLE', motoMakes, 'T2MTO', 'PRM-MTO-', 'EMPLOYEE', 0);
  pushFleet('TRUCK', truckMakes, 'T3TRK', 'PRM-TRK-', 'CONTRACTOR', 0);
  pushFleet('BUS', busMakes, 'T4BUS', 'PRM-BUS-', 'RESERVED', 0);

  // Ensure exactly 10 of each type (fill any gaps if classic plates consumed slots)
  const ensureTen = (
    type: SeedVehType,
    makes: readonly (readonly [string, string])[],
    platePrefix: string,
    permitPrefix: string,
    permitType: SeedPermitType,
  ) => {
    let count = vehicleSeeds.filter((v) => v.type === type).length;
    let i = 1;
    while (count < 10 && i <= 20) {
      const plate = `${platePrefix}${String(i).padStart(2, '0')}`;
      if (!vehicleSeeds.some((v) => v.plate === plate)) {
        const [make, model] = makes[(i - 1) % makes.length]!;
        vehicleSeeds.push({
          plate,
          type,
          make,
          model,
          color: colors[(i - 1) % colors.length]!,
          owner: owners[(i - 1) % owners.length]!,
          phone: `+25575502${String(i).padStart(4, '0')}`,
          permit: `${permitPrefix}${String(i).padStart(2, '0')}`,
          permitType,
          siteId: i % 2 === 0 ? siteOffice.id : site.id,
        });
        count += 1;
      }
      i += 1;
    }
  };
  ensureTen('CAR', carMakes, 'T1CAR', 'PRM-CAR-', 'EMPLOYEE');
  ensureTen('MOTORCYCLE', motoMakes, 'T2MTO', 'PRM-MTO-', 'EMPLOYEE');
  ensureTen('TRUCK', truckMakes, 'T3TRK', 'PRM-TRK-', 'CONTRACTOR');
  ensureTen('BUS', busMakes, 'T4BUS', 'PRM-BUS-', 'RESERVED');

  for (const v of vehicleSeeds) {
    const veh = await prisma.vehicle.upsert({
      where: {
        organizationId_plateNumber: {
          organizationId: org.id,
          plateNumber: v.plate,
        },
      },
      update: {
        customerId: customer.id,
        vehicleType: v.type,
        make: v.make,
        model: v.model,
        color: v.color,
        ownerName: v.owner,
        ownerPhone: v.phone,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        customerId: customer.id,
        plateNumber: v.plate,
        vehicleType: v.type,
        make: v.make,
        model: v.model,
        color: v.color,
        ownerName: v.owner,
        ownerPhone: v.phone,
        createdBy: admin.id,
      },
    });
    await prisma.parkingPermit.upsert({
      where: {
        organizationId_permitNumber: {
          organizationId: org.id,
          permitNumber: v.permit,
        },
      },
      update: {
        vehicleId: veh.id,
        siteId: v.siteId,
        permitType: v.permitType,
        status: 'ACTIVE',
        validFrom: permitValidFrom,
        validUntil: permitValidUntil,
      },
      create: {
        organizationId: org.id,
        vehicleId: veh.id,
        siteId: v.siteId,
        permitNumber: v.permit,
        permitType: v.permitType,
        status: 'ACTIVE',
        validFrom: permitValidFrom,
        validUntil: permitValidUntil,
        createdBy: admin.id,
      },
    });
  }

  const now = new Date();
  const visitorSeeds: {
    referenceNumber: string;
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string;
    purpose: string;
    hostName: string;
    status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
    fromHours: number;
    untilHours: number;
    siteId: string;
    plate?: string;
  }[] = [
    {
      referenceNumber: 'VIS-DEMO-001',
      visitorName: 'Samuel Okello',
      visitorEmail: 'samuel.okello@vendor.co.tz',
      visitorPhone: '+255712111001',
      purpose: 'Supplier delivery — packaging materials',
      hostName: 'Jane Doe',
      status: 'APPROVED',
      fromHours: -2,
      untilHours: 6,
      siteId: site.id,
      plate: 'T998XYZ',
    },
    {
      referenceNumber: 'VIS-DEMO-002',
      visitorName: 'Fatuma Ally',
      visitorEmail: 'fatuma@auditpartners.tz',
      visitorPhone: '+255712111002',
      purpose: 'External audit kickoff meeting',
      hostName: 'Aisha Hassan',
      status: 'APPROVED',
      fromHours: 1,
      untilHours: 8,
      siteId: siteOffice.id,
    },
    {
      referenceNumber: 'VIS-DEMO-003',
      visitorName: 'Daniel Mushi',
      visitorEmail: 'd.mushi@techfix.co.tz',
      visitorPhone: '+255712111003',
      purpose: 'IT infrastructure survey',
      hostName: 'Peter Mwangi',
      status: 'PENDING',
      fromHours: 24,
      untilHours: 30,
      siteId: siteOffice.id,
    },
    {
      referenceNumber: 'VIS-DEMO-007',
      visitorName: 'Hassan Omari',
      visitorEmail: 'hassan.omari@logistics.tz',
      visitorPhone: '+255712111007',
      purpose: 'Courier drop-off — spare radios',
      hostName: 'Aisha Hassan',
      status: 'PENDING',
      fromHours: 4,
      untilHours: 10,
      siteId: site.id,
    },
    {
      referenceNumber: 'VIS-DEMO-004',
      visitorName: 'Maria Juma',
      visitorEmail: 'maria.juma@gmail.com',
      visitorPhone: '+255712111004',
      purpose: 'Interview — warehouse supervisor candidate',
      hostName: 'Grace Nelly',
      status: 'COMPLETED',
      fromHours: -28,
      untilHours: -22,
      siteId: site.id,
    },
    {
      referenceNumber: 'VIS-DEMO-005',
      visitorName: 'Unknown Contractor',
      visitorEmail: 'unknown@mail.test',
      visitorPhone: '+255712111005',
      purpose: 'Unscheduled site walkthrough',
      hostName: 'Joseph Kimaro',
      status: 'REJECTED',
      fromHours: -5,
      untilHours: 2,
      siteId: site.id,
    },
    {
      referenceNumber: 'VIS-DEMO-006',
      visitorName: 'Rehema Said',
      visitorEmail: 'rehema@clients.co.tz',
      visitorPhone: '+255712111006',
      purpose: 'Client tour — Warehouse A operations',
      hostName: 'Jane Doe',
      status: 'APPROVED',
      fromHours: 48,
      untilHours: 54,
      siteId: site.id,
      plate: 'T555VIP',
    },
  ];
  for (const v of visitorSeeds) {
    const validFrom = new Date(now.getTime() + v.fromHours * 3600_000);
    const validUntil = new Date(now.getTime() + v.untilHours * 3600_000);
    await prisma.visitorAppointment.upsert({
      where: {
        organizationId_referenceNumber: {
          organizationId: org.id,
          referenceNumber: v.referenceNumber,
        },
      },
      update: {
        visitorName: v.visitorName,
        visitorEmail: v.visitorEmail,
        visitorPhone: v.visitorPhone,
        purpose: v.purpose,
        hostName: v.hostName,
        status: v.status,
        validFrom,
        validUntil,
        siteId: v.siteId,
        customerId: customer.id,
        vehiclePlate: v.plate ?? null,
        approvedBy: v.status === 'APPROVED' || v.status === 'COMPLETED' ? admin.id : null,
        approvedAt:
          v.status === 'APPROVED' || v.status === 'COMPLETED' ? now : null,
        rejectedReason:
          v.status === 'REJECTED' ? 'Host unavailable / incomplete documents' : null,
      },
      create: {
        organizationId: org.id,
        customerId: customer.id,
        siteId: v.siteId,
        gateId: gate.id,
        referenceNumber: v.referenceNumber,
        visitorName: v.visitorName,
        visitorEmail: v.visitorEmail,
        visitorPhone: v.visitorPhone,
        companyName: 'Demo Manufacturing visitor',
        purpose: v.purpose,
        hostName: v.hostName,
        vehiclePlate: v.plate,
        validFrom,
        validUntil,
        status: v.status,
        approvedBy: v.status === 'APPROVED' || v.status === 'COMPLETED' ? admin.id : null,
        approvedAt:
          v.status === 'APPROVED' || v.status === 'COMPLETED' ? now : null,
        rejectedReason:
          v.status === 'REJECTED' ? 'Host unavailable / incomplete documents' : null,
        createdBy: admin.id,
      },
    });
  }

  const blacklistDemo: { plate: string; reason: string; inactive?: boolean }[] =
    [
      { plate: 'BLACKLIST1', reason: 'Demo blacklist plate' },
      { plate: 'T1CAR08', reason: 'Temporary security hold' },
      { plate: 'FRAUD99', reason: 'Suspected plate cloning / fraud' },
      { plate: 'T3TRK06', reason: 'Unpaid parking invoices (contractor)' },
      { plate: 'HOTZONE1', reason: 'Repeated wrong-zone violations' },
      { plate: 'T2MTO08', reason: 'Stolen vehicle report (pending verify)' },
      { plate: 'EXITBAN2', reason: 'Gate barrier damage incident', inactive: true },
      { plate: 'T4BUS05', reason: 'Unauthorized overnight staging' },
      { plate: 'WATCHME1', reason: 'Watchlist — customer request' },
      { plate: 'OLDPLATE', reason: 'Deactivated sample for UI history', inactive: true },
    ];
  for (const bl of blacklistDemo) {
    const existing = await prisma.vehicleBlacklist.findFirst({
      where: {
        organizationId: org.id,
        plateNumber: bl.plate,
      },
    });
    if (existing) {
      await prisma.vehicleBlacklist.update({
        where: { id: existing.id },
        data: {
          reason: bl.reason,
          isActive: !bl.inactive,
        },
      });
    } else {
      await prisma.vehicleBlacklist.create({
        data: {
          organizationId: org.id,
          plateNumber: bl.plate,
          reason: bl.reason,
          isActive: !bl.inactive,
          createdBy: admin.id,
        },
      });
    }
  }

  // Demo gate entries for parking-web /entries UI showcase
  const entryDemoPlates = [
    'T123ABC',
    'T456DEF',
    'T789GHI',
    'T321JKL',
    'T1CAR03',
    'T1CAR04',
    'T2MTO02',
    'T2MTO03',
    'T3TRK02',
    'T3TRK03',
    'T4BUS01',
    'T4BUS02',
    'BLACKLIST1',
  ];
  for (let i = 0; i < entryDemoPlates.length; i++) {
    const plate = entryDemoPlates[i]!;
    const clientEventId = `seed-parking-entry-${plate}-${i}`;
    const exists = await prisma.parkingEntry.findFirst({
      where: { clientEventId },
    });
    if (exists) continue;
    const veh = await prisma.vehicle.findFirst({
      where: { organizationId: org.id, plateNumber: plate },
    });
    const useOffice = i % 3 === 0;
    const denied = plate === 'BLACKLIST1' || i % 7 === 0;
    await prisma.parkingEntry.create({
      data: {
        organizationId: org.id,
        siteId: useOffice ? siteOffice.id : site.id,
        gateId: vehicleGate.id,
        vehicleId: veh?.id ?? null,
        plateNumber: plate,
        direction: i % 4 === 0 ? 'EXIT' : 'ENTRY',
        decision: denied ? 'DENY' : 'ALLOW',
        recordedBy: admin.id,
        clientEventId,
        recordedAt: new Date(Date.now() - i * 45 * 60_000),
      },
    });
  }

  // Demo ANPR captures for parking-web /anpr decide board
  const anprDemo: {
    plate: string;
    decision: 'PENDING' | 'ALLOW' | 'DENY';
    confidence: number;
    cameraId: string;
    denyReason?: string;
    siteOffice?: boolean;
  }[] = [
    { plate: 'T1CAR05', decision: 'PENDING', confidence: 0.96, cameraId: 'CAM-GATE-01' },
    { plate: 'T2MTO04', decision: 'PENDING', confidence: 0.88, cameraId: 'CAM-GATE-01' },
    { plate: 'T3TRK04', decision: 'PENDING', confidence: 0.91, cameraId: 'CAM-PARK-01' },
    { plate: 'UNK888', decision: 'PENDING', confidence: 0.72, cameraId: 'CAM-YARD-01' },
    { plate: 'T4BUS03', decision: 'PENDING', confidence: 0.94, cameraId: 'CAM-GATE-01', siteOffice: true },
    { plate: 'T123ABC', decision: 'ALLOW', confidence: 0.97, cameraId: 'CAM-GATE-01' },
    { plate: 'T456DEF', decision: 'ALLOW', confidence: 0.93, cameraId: 'CAM-PARK-01' },
    { plate: 'T789GHI', decision: 'ALLOW', confidence: 0.89, cameraId: 'CAM-YARD-01' },
    { plate: 'ZZZ999', decision: 'DENY', confidence: 0.91, cameraId: 'CAM-GATE-01', denyReason: 'No permit' },
    { plate: 'BLACKLIST1', decision: 'DENY', confidence: 0.95, cameraId: 'CAM-GATE-01', denyReason: 'Blacklisted' },
    { plate: 'T1CAR06', decision: 'ALLOW', confidence: 0.86, cameraId: 'CAM-WH-01', siteOffice: true },
    { plate: 'T2MTO05', decision: 'DENY', confidence: 0.68, cameraId: 'CAM-PARK-01', denyReason: 'Low confidence / manual review' },
  ];
  for (let i = 0; i < anprDemo.length; i++) {
    const a = anprDemo[i]!;
    const seedKey = `seed-anpr-${a.plate}-${a.decision}-${i}`;
    const exists = await prisma.anprResult.findFirst({
      where: {
        organizationId: org.id,
        rawPayload: { path: ['seedKey'], equals: seedKey },
      },
    });
    if (exists) continue;
    await prisma.anprResult.create({
      data: {
        organizationId: org.id,
        siteId: a.siteOffice ? siteOffice.id : site.id,
        gateId: vehicleGate.id,
        plateNumber: a.plate,
        confidence: a.confidence,
        cameraId: a.cameraId,
        imageUrl: `https://example.invalid/anpr/${a.plate.toLowerCase()}.jpg`,
        decision: a.decision,
        denyReason: a.denyReason ?? null,
        decidedBy: a.decision === 'PENDING' ? null : admin.id,
        decidedAt:
          a.decision === 'PENDING' ? null : new Date(Date.now() - i * 30 * 60_000),
        capturedAt: new Date(Date.now() - i * 20 * 60_000),
        rawPayload: { seed: true, seedKey },
      },
    });
  }

  // Demo violations for parking-web /violations UI
  const violationDemo: {
    plate: string;
    type: 'NO_PERMIT' | 'EXPIRED_PERMIT' | 'WRONG_ZONE' | 'OVERSTAY' | 'BLACKLISTED';
    description: string;
    siteOffice?: boolean;
  }[] = [
    { plate: 'ZZZ999', type: 'NO_PERMIT', description: 'No permit — ANPR deny' },
    { plate: 'BLACKLIST1', type: 'BLACKLISTED', description: 'Plate on active blacklist' },
    { plate: 'UNK888', type: 'NO_PERMIT', description: 'Unknown plate at vehicle gate' },
    { plate: 'T1CAR07', type: 'EXPIRED_PERMIT', description: 'Permit expired overnight' },
    { plate: 'T2MTO06', type: 'WRONG_ZONE', description: 'Motorcycle in reserved bay', siteOffice: true },
    { plate: 'T3TRK05', type: 'OVERSTAY', description: 'Truck exceeded allocated window' },
    { plate: 'T4BUS04', type: 'WRONG_ZONE', description: 'Bus parked outside contractor zone' },
    { plate: 'T456DEF', type: 'OVERSTAY', description: 'Visitor overstay after valid-until', siteOffice: true },
    { plate: 'T789GHI', type: 'NO_PERMIT', description: 'Contractor permit suspended period' },
    { plate: 'T321JKL', type: 'EXPIRED_PERMIT', description: 'Employee permit renewal pending' },
    { plate: 'T1CAR08', type: 'BLACKLISTED', description: 'Temporary security hold' },
    { plate: 'T2MTO07', type: 'NO_PERMIT', description: 'No matching ACTIVE permit for site' },
  ];
  for (let i = 0; i < violationDemo.length; i++) {
    const v = violationDemo[i]!;
    const seedDesc = `[seed:${i}] ${v.description}`;
    const exists = await prisma.parkingViolation.findFirst({
      where: {
        organizationId: org.id,
        plateNumber: v.plate,
        description: seedDesc,
      },
    });
    if (exists) continue;
    const veh = await prisma.vehicle.findFirst({
      where: { organizationId: org.id, plateNumber: v.plate },
    });
    await prisma.parkingViolation.create({
      data: {
        organizationId: org.id,
        siteId: v.siteOffice ? siteOffice.id : site.id,
        plateNumber: v.plate,
        vehicleId: veh?.id ?? null,
        violationType: v.type,
        description: seedDesc,
        createdBy: admin.id,
        recordedAt: new Date(Date.now() - i * 55 * 60_000),
      },
    });
  }

  const guardProfile = await prisma.guardProfile.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: guardUser.id,
      },
    },
    update: {
      deploymentEligible: true,
      trainingCompleted: true,
      clearanceVerified: true,
      firearmAuthorized: true,
      firearmExpiry: new Date('2030-12-31'),
    },
    create: {
      organizationId: org.id,
      userId: guardUser.id,
      employeeNumber: 'GRD-0001',
      deploymentEligible: true,
      trainingCompleted: true,
      clearanceVerified: true,
      firearmAuthorized: true,
      firearmExpiry: new Date('2030-12-31'),
      phone: '+255712345678',
    },
  });

  // G2: link ACTIVE warehouse deployment to CTR-DEMO-GUARD-2026 (idempotent)
  const guardDemoContract = await prisma.contract.findFirst({
    where: {
      organizationId: org.id,
      contractNumber: 'CTR-DEMO-GUARD-2026',
    },
    select: { id: true },
  });

  const existingActiveDeployment = await prisma.guardDeployment.findFirst({
    where: {
      organizationId: org.id,
      guardId: guardProfile.id,
      status: 'ACTIVE',
    },
  });
  if (!existingActiveDeployment) {
    await prisma.guardDeployment.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        contractId: guardDemoContract?.id,
        startDate: new Date('2024-06-01'),
        status: 'ACTIVE',
        createdBy: admin.id,
      },
    });
  } else if (
    guardDemoContract &&
    existingActiveDeployment.siteId === site.id &&
    existingActiveDeployment.contractId !== guardDemoContract.id
  ) {
    await prisma.guardDeployment.update({
      where: { id: existingActiveDeployment.id },
      data: { contractId: guardDemoContract.id },
    });
  }

  // Extra guards on CUST-DEMO sites — richer Customer Portal /guards roster
  const portalGuardRoster: {
    email: string;
    fullName: string;
    number: string;
    phone: string;
    siteId: string;
  }[] = [
    {
      email: 'guard2@highlink.co.tz',
      fullName: 'Mary Kileo',
      number: 'GRD-0002',
      phone: '+255712345679',
      siteId: site.id,
    },
    {
      email: 'guard3@highlink.co.tz',
      fullName: 'Hassan Juma',
      number: 'GRD-0003',
      phone: '+255712345680',
      siteId: site.id,
    },
    {
      email: 'guard4@highlink.co.tz',
      fullName: 'Neema Ally',
      number: 'GRD-0004',
      phone: '+255712345681',
      siteId: siteOffice.id,
    },
  ];
  for (const g of portalGuardRoster) {
    const u = await prisma.user.upsert({
      where: { email: g.email },
      update: { fullName: g.fullName },
      create: {
        email: g.email,
        fullName: g.fullName,
        passwordHash,
        organizationId: org.id,
        roles: { create: [{ roleId: guardRole.id }] },
      },
    });
    const gp = await prisma.guardProfile.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: u.id,
        },
      },
      update: {
        deploymentEligible: true,
        phone: g.phone,
        status: 'ACTIVE',
        // G3: GRD-0002 training only; others incomplete
        trainingCompleted: g.number === 'GRD-0002',
        clearanceVerified: false,
        firearmAuthorized: false,
        firearmExpiry: null,
      },
      create: {
        organizationId: org.id,
        userId: u.id,
        employeeNumber: g.number,
        deploymentEligible: true,
        phone: g.phone,
        status: 'ACTIVE',
        trainingCompleted: g.number === 'GRD-0002',
        clearanceVerified: false,
        firearmAuthorized: false,
      },
    });
    await prisma.employee.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: org.id,
          employeeNumber: g.number,
        },
      },
      update: {
        guardProfileId: gp.id,
        userId: u.id,
        fullName: g.fullName,
        phone: g.phone,
        status: 'ACTIVE',
      },
      create: {
        organizationId: org.id,
        userId: u.id,
        guardProfileId: gp.id,
        employeeNumber: g.number,
        fullName: g.fullName,
        email: g.email,
        phone: g.phone,
        department: 'Operations',
        employmentType: 'GUARD',
        hireDate: new Date('2024-03-01'),
        createdBy: admin.id,
      },
    });
    const activeDep = await prisma.guardDeployment.findFirst({
      where: {
        organizationId: org.id,
        guardId: gp.id,
        status: 'ACTIVE',
      },
    });
    const warehouseContractId =
      g.siteId === site.id ? guardDemoContract?.id : undefined;
    if (!activeDep) {
      await prisma.guardDeployment.create({
        data: {
          organizationId: org.id,
          guardId: gp.id,
          siteId: g.siteId,
          contractId: warehouseContractId,
          startDate: new Date('2025-01-15'),
          status: 'ACTIVE',
          createdBy: admin.id,
        },
      });
    } else {
      const patch: { siteId?: string; contractId?: string } = {};
      if (activeDep.siteId !== g.siteId) patch.siteId = g.siteId;
      if (
        warehouseContractId &&
        (patch.siteId ?? activeDep.siteId) === site.id &&
        activeDep.contractId !== warehouseContractId
      ) {
        patch.contractId = warehouseContractId;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.guardDeployment.update({
          where: { id: activeDep.id },
          data: patch,
        });
      }
    }
  }

  const existingDemoAlert = await prisma.fieldAlert.findFirst({
    where: {
      organizationId: org.id,
      siteId: site.id,
      alertType: 'ALERTNESS_MISSED',
      acknowledged: false,
      message: 'Demo: Guard GRD-0001 missed alertness check',
    },
  });
  if (!existingDemoAlert) {
    await prisma.fieldAlert.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        guardId: guardProfile.id,
        alertType: 'ALERTNESS_MISSED',
        severity: 'HIGH',
        message: 'Demo: Guard GRD-0001 missed alertness check',
      },
    });
  }

  // Branch Ops EOB — demo append-only entries at SITE-WAREHOUSE-A
  const existingEobRoutine = await prisma.occurrenceEntry.findFirst({
    where: {
      organizationId: org.id,
      siteId: site.id,
      category: 'ROUTINE',
      description: 'Demo: Night patrol completed — all gates secure',
      isCurrent: true,
    },
  });
  if (!existingEobRoutine) {
    const eobAt = new Date();
    eobAt.setHours(eobAt.getHours() - 3);
    await prisma.occurrenceEntry.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        officerId: supervisorUser.id,
        category: 'ROUTINE',
        description: 'Demo: Night patrol completed — all gates secure',
        recordedAt: eobAt,
      },
    });
  }

  const existingEobVisitor = await prisma.occurrenceEntry.findFirst({
    where: {
      organizationId: org.id,
      siteId: site.id,
      category: 'VISITOR_ISSUE',
      description:
        'Demo: Visitor arrived without host confirmation; verified at GATE-MAIN',
      isCurrent: true,
    },
  });
  if (!existingEobVisitor) {
    const eobAt = new Date();
    eobAt.setHours(eobAt.getHours() - 1);
    await prisma.occurrenceEntry.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        officerId: supervisorUser.id,
        category: 'VISITOR_ISSUE',
        description:
          'Demo: Visitor arrived without host confirmation; verified at GATE-MAIN',
        recordedAt: eobAt,
      },
    });
  }

  // Customer portal ops — demo incidents at SITE-WAREHOUSE-A (CUST-DEMO)
  const warehouseIncidentCount = await prisma.incident.count({
    where: { organizationId: org.id, siteId: site.id },
  });
  if (warehouseIncidentCount === 0) {
    const incidentSeeds: {
      incidentNumber: string;
      category: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
      title: string;
      description: string;
      hoursAgo: number;
      resolved?: boolean;
    }[] = [
      {
        incidentNumber: 'INC-DEMO-00001',
        category: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        status: 'OPEN',
        title: 'Demo: Unidentified person near loading bay',
        description:
          'Guard observed an unidentified person near the loading bay after hours. Area secured; awaiting investigation.',
        hoursAgo: 6,
      },
      {
        incidentNumber: 'INC-DEMO-00002',
        category: 'ACCESS_BREACH',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        title: 'Demo: Forced gate attempt at GATE-MAIN',
        description:
          'Attempted forced entry at GATE-MAIN. Gate officer denied access; CCTV metadata event linked. Investigation ongoing.',
        hoursAgo: 30,
      },
      {
        incidentNumber: 'INC-DEMO-00003',
        category: 'PROPERTY_DAMAGE',
        severity: 'LOW',
        status: 'RESOLVED',
        title: 'Demo: Minor fence damage — west perimeter',
        description:
          'Minor fence damage reported on west perimeter. Temporary repair completed; permanent fix scheduled.',
        hoursAgo: 72,
        resolved: true,
      },
      {
        incidentNumber: 'INC-DEMO-00004',
        category: 'SECURITY_BREACH',
        severity: 'CRITICAL',
        status: 'RESOLVED',
        title: 'Demo: CRITICAL breach — awaiting GM/CEO close (A4b)',
        description:
          'Major security breach resolved at site. Close requires GENERAL_MANAGER or CEO (reporter SoD applies).',
        hoursAgo: 12,
        resolved: true,
      },
    ];
    for (const s of incidentSeeds) {
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - s.hoursAgo);
      await prisma.incident.create({
        data: {
          organizationId: org.id,
          siteId: site.id,
          incidentNumber: s.incidentNumber,
          category: s.category,
          severity: s.severity,
          status: s.status,
          title: s.title,
          description: s.description,
          reporterId: supervisorUser.id,
          createdAt,
          resolvedAt: s.resolved ? createdAt : null,
        },
      });
    }
  }

  // A4b: ensure CRITICAL close demo exists even on re-seed
  const existingCrit = await prisma.incident.findFirst({
    where: {
      organizationId: org.id,
      incidentNumber: 'INC-DEMO-00004',
    },
  });
  if (!existingCrit) {
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - 12);
    await prisma.incident.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        incidentNumber: 'INC-DEMO-00004',
        category: 'SECURITY_BREACH',
        severity: 'CRITICAL',
        status: 'RESOLVED',
        title: 'Demo: CRITICAL breach — awaiting GM/CEO close (A4b)',
        description:
          'Major security breach resolved at site. Close requires GENERAL_MANAGER or CEO (reporter SoD applies).',
        reporterId: supervisorUser.id,
        createdAt,
        resolvedAt: createdAt,
      },
    });
  }

  // Past-due SCHEDULED check — Branch Ops Scan missed / Mark missed demo
  const existingPendingAlertness = await prisma.alertnessCheck.findFirst({
    where: { referenceNumber: 'ALT-DEMO-PENDING' },
  });
  const pendingScheduledAt = new Date(Date.now() - 20 * 60 * 1000);
  if (!existingPendingAlertness) {
    await prisma.alertnessCheck.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        scheduledAt: pendingScheduledAt,
        status: 'SCHEDULED',
        referenceNumber: 'ALT-DEMO-PENDING',
      },
    });
  } else {
    await prisma.alertnessCheck.update({
      where: { id: existingPendingAlertness.id },
      data: {
        guardId: guardProfile.id,
        siteId: site.id,
        scheduledAt: pendingScheduledAt,
        status: 'SCHEDULED',
        confirmedAt: null,
        method: null,
      },
    });
  }

  // Future pending — Guard app confirm demo (not yet overdue)
  const existingFutureAlertness = await prisma.alertnessCheck.findFirst({
    where: { referenceNumber: 'ALT-DEMO-FUTURE' },
  });
  const futureScheduledAt = new Date(Date.now() + 45 * 60 * 1000);
  if (!existingFutureAlertness) {
    await prisma.alertnessCheck.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        scheduledAt: futureScheduledAt,
        status: 'SCHEDULED',
        referenceNumber: 'ALT-DEMO-FUTURE',
      },
    });
  } else {
    await prisma.alertnessCheck.update({
      where: { id: existingFutureAlertness.id },
      data: {
        guardId: guardProfile.id,
        siteId: site.id,
        scheduledAt: futureScheduledAt,
        status: 'SCHEDULED',
        confirmedAt: null,
        method: null,
      },
    });
  }

  const employee = await prisma.employee.upsert({
    where: {
      organizationId_employeeNumber: {
        organizationId: org.id,
        employeeNumber: 'GRD-0001',
      },
    },
    update: {
      guardProfileId: guardProfile.id,
      userId: guardUser.id,
      fullName: 'John Guard',
    },
    create: {
      organizationId: org.id,
      userId: guardUser.id,
      guardProfileId: guardProfile.id,
      employeeNumber: 'GRD-0001',
      fullName: 'John Guard',
      email: 'guard1@highlink.co.tz',
      phone: '+255712345678',
      department: 'Operations',
      employmentType: 'GUARD',
      hireDate: new Date('2024-01-15'),
      createdBy: admin.id,
    },
  });

  const salaryFrom = new Date('2024-01-01');
  const existingSalary = await prisma.salaryAssignment.findFirst({
    where: { employeeId: employee.id, isActive: true },
  });
  if (!existingSalary) {
    await prisma.salaryAssignment.create({
      data: {
        organizationId: org.id,
        employeeId: employee.id,
        basicSalary: 850000,
        currency: 'TZS',
        hourlyRate: 5000,
        allowances: { TRANSPORT: 50000, RISK: 75000 },
        effectiveFrom: salaryFrom,
        createdBy: admin.id,
      },
    });
  }

  // Office staff ESS demo (§35.5) — supervisor linked to employee (non-guard)
  await prisma.employee.upsert({
    where: {
      organizationId_employeeNumber: {
        organizationId: org.id,
        employeeNumber: 'OFF-SUP-001',
      },
    },
    update: {
      userId: supervisorUser.id,
      fullName: 'Sam Supervisor',
      email: 'supervisor1@highlink.co.tz',
      employmentType: 'SUPERVISOR',
      department: 'Field Operations',
    },
    create: {
      organizationId: org.id,
      userId: supervisorUser.id,
      employeeNumber: 'OFF-SUP-001',
      fullName: 'Sam Supervisor',
      email: 'supervisor1@highlink.co.tz',
      phone: '+255713000001',
      department: 'Field Operations',
      employmentType: 'SUPERVISOR',
      hireDate: new Date('2023-06-01'),
      createdBy: admin.id,
    },
  });

  // Demo asset on guard for ESS equipment return / storekeeper confirm smoke.
  // Re-assign if previously returned so re-seed stays usable.
  const radio = await prisma.asset.upsert({
    where: {
      organizationId_assetTag: {
        organizationId: org.id,
        assetTag: 'AST-RADIO-001',
      },
    },
    update: { name: 'Handheld Radio R1', category: 'RADIO' },
    create: {
      organizationId: org.id,
      assetTag: 'AST-RADIO-001',
      name: 'Handheld Radio R1',
      category: 'RADIO',
      status: 'AVAILABLE',
      createdBy: admin.id,
    },
  });
  const activeRadio = await prisma.assetAssignment.findFirst({
    where: {
      organizationId: org.id,
      assetId: radio.id,
      returnedAt: null,
    },
  });
  if (!activeRadio) {
    // Demo radio may be DISPOSED/AVAILABLE after return smokes — reset + re-issue.
    await prisma.asset.update({
      where: { id: radio.id },
      data: { status: 'AVAILABLE' },
    });
    await prisma.assetAssignment.create({
      data: {
        organizationId: org.id,
        assetId: radio.id,
        assignedToEmployeeId: employee.id,
        assignedToGuardId: guardProfile.id,
        notes: 'Demo ESS returnable radio',
        createdBy: admin.id,
      },
    });
    await prisma.asset.update({
      where: { id: radio.id },
      data: { status: 'ASSIGNED' },
    });
  } else if (
    radio.status !== 'ASSIGNED' &&
    radio.status !== 'RETURN_PENDING'
  ) {
    await prisma.asset.update({
      where: { id: radio.id },
      data: { status: 'ASSIGNED' },
    });
  }

  await prisma.leaveType.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'ANNUAL' },
    },
    update: {},
    create: {
      organizationId: org.id,
      code: 'ANNUAL',
      name: 'Annual Leave',
      annualQuotaDays: 21,
    },
  });

  const existingRule = await prisma.payrollRuleVersion.findFirst({
    where: { organizationId: org.id, isCurrent: true },
  });
  if (!existingRule) {
    await prisma.payrollRuleVersion.updateMany({
      where: { organizationId: org.id },
      data: { isCurrent: false },
    });
    await prisma.payrollRuleVersion.create({
      data: {
        organizationId: org.id,
        version: 1,
        name: 'TZ Statutory v1 (simplified)',
        rules: {
          nssfEmployeeRate: 0.1,
          payeRate: 0.1,
          currency: 'TZS',
        },
        effectiveFrom: new Date('2024-01-01'),
        isCurrent: true,
        createdBy: admin.id,
      },
    });
  }

  await prisma.jobPosting.upsert({
    where: { id: '00000000-0000-4000-8000-000000000101' },
    update: { status: 'OPEN', publishedAt: new Date() },
    create: {
      id: '00000000-0000-4000-8000-000000000101',
      organizationId: org.id,
      title: 'Security Guard — Industrial Sites',
      department: 'Operations',
      location: 'Dar es Salaam',
      description: 'Experienced security guard for warehouse and industrial client sites.',
      requirements: 'Valid guard license, physical fitness, basic English',
      status: 'OPEN',
      publishedAt: new Date(),
      createdBy: admin.id,
    },
  });

  await prisma.jobPosting.upsert({
    where: { id: '00000000-0000-4000-8000-000000000102' },
    update: { status: 'OPEN' },
    create: {
      id: '00000000-0000-4000-8000-000000000102',
      organizationId: org.id,
      title: 'Site Supervisor — Night Shift',
      department: 'Operations',
      location: 'Dar es Salaam',
      description: 'Lead night-shift guards at industrial sites; report to branch ops.',
      requirements: '2+ years supervisory experience, driver license preferred',
      status: 'OPEN',
      publishedAt: new Date(),
      createdBy: admin.id,
    },
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(6, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setDate(5);
  monthEnd.setHours(14, 0, 0, 0);
  const existingAttendance = await prisma.guardAttendance.findFirst({
    where: { guardId: guardProfile.id, clientEventId: 'seed-payroll-att-001' },
  });
  if (!existingAttendance) {
    await prisma.guardAttendance.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        clockInAt: monthStart,
        clockOutAt: monthEnd,
        clockInMethod: 'MOBILE_GPS',
        clockOutMethod: 'MOBILE_GPS',
        clockInLatitude: -6.7924,
        clockInLongitude: 39.2083,
        clockOutLatitude: -6.7924,
        clockOutLongitude: 39.2083,
        supervisorApproved: true,
        clientEventId: 'seed-payroll-att-001',
      },
    });
  }

  // Branch Ops attendance board — open clock-in for "today" (refresh on re-seed)
  const todayClockIn = new Date();
  todayClockIn.setHours(6, 15, 0, 0);
  const existingTodayAtt = await prisma.guardAttendance.findFirst({
    where: { clientEventId: 'seed-branch-att-today-open' },
  });
  if (!existingTodayAtt) {
    await prisma.guardAttendance.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        clockInAt: todayClockIn,
        clockInMethod: 'MOBILE_GPS',
        clockInLatitude: -6.7924,
        clockInLongitude: 39.2083,
        supervisorApproved: false,
        clientEventId: 'seed-branch-att-today-open',
        remarks: 'Demo: on duty for Branch Ops attendance board',
      },
    });
  } else {
    await prisma.guardAttendance.update({
      where: { id: existingTodayAtt.id },
      data: {
        siteId: site.id,
        guardId: guardProfile.id,
        clockInAt: todayClockIn,
        clockOutAt: null,
        supervisorApproved: false,
        remarks: 'Demo: on duty for Branch Ops attendance board',
      },
    });
  }

  void gate;
  void vehicleGate;
  void customerEmployee;

  const cpGate = await prisma.checkpoint.upsert({
    where: {
      organizationId_siteId_code: {
        organizationId: org.id,
        siteId: site.id,
        code: 'CP-GATE-01',
      },
    },
    update: { nfcTagId: 'NFC-CP-GATE-01' },
    create: {
      organizationId: org.id,
      siteId: site.id,
      code: 'CP-GATE-01',
      name: 'Main Gate',
      zone: 'PERIMETER',
      qrCode: 'CP-GATE-01',
      nfcTagId: 'NFC-CP-GATE-01',
      latitude: -6.7924,
      longitude: 39.2083,
    },
  });
  const cpYard = await prisma.checkpoint.upsert({
    where: {
      organizationId_siteId_code: {
        organizationId: org.id,
        siteId: site.id,
        code: 'CP-YARD-01',
      },
    },
    update: { nfcTagId: 'NFC-CP-YARD-01' },
    create: {
      organizationId: org.id,
      siteId: site.id,
      code: 'CP-YARD-01',
      name: 'Yard East',
      zone: 'YARD',
      qrCode: 'CP-YARD-01',
      nfcTagId: 'NFC-CP-YARD-01',
      latitude: -6.7926,
      longitude: 39.2085,
    },
  });
  const existingRoute = await prisma.patrolRoute.findFirst({
    where: {
      organizationId: org.id,
      siteId: site.id,
      name: 'Warehouse perimeter loop',
    },
  });
  // A4a: due at midnight so demo route is LATE/MISSED after day start (no scans seeded)
  const patrolRoute =
    existingRoute ??
    (await prisma.patrolRoute.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        name: 'Warehouse perimeter loop',
        checkpointIds: [cpGate.id, cpYard.id],
        dueMinutesFromMidnight: 0,
      },
    }));
  if (existingRoute) {
    await prisma.patrolRoute.update({
      where: { id: existingRoute.id },
      data: {
        checkpointIds: [cpGate.id, cpYard.id],
        isActive: true,
        dueMinutesFromMidnight: 0,
      },
    });
  }

  const dayKey = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const patrolMissToken = `[${patrolRoute.id}@${dayKey}]`;
  const existingPatrolMiss = await prisma.fieldAlert.findFirst({
    where: {
      organizationId: org.id,
      siteId: site.id,
      alertType: 'PATROL_MISSED',
      acknowledged: false,
      message: { contains: patrolMissToken },
    },
  });
  if (!existingPatrolMiss) {
    await prisma.fieldAlert.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        alertType: 'PATROL_MISSED',
        severity: 'HIGH',
        message: `Patrol route missed: Warehouse perimeter loop ${patrolMissToken}`,
        escalationStage: 'SUPERVISOR',
      },
    });
  }

  // CCTV control-room demo — Device type CCTV_CAMERA + config JSON (URLs/metadata only; no Nest video)
  const cctvCameras: Array<{
    code: string;
    name: string;
    vendor: string;
    model: string;
    status: 'ONLINE' | 'OFFLINE';
    gateId?: string;
    config: Record<string, unknown>;
  }> = [
    {
      code: 'CAM-GATE-01',
      name: 'Main Gate Camera',
      vendor: 'Hikvision',
      model: 'DS-2CD2143G2',
      status: 'ONLINE',
      gateId: gate.id,
      config: {
        streamUrl: '',
        embedUrl: '',
        snapshotUrl: '',
        zone: 'Gate',
        gridOrder: 1,
        nvrChannel: 'CH01',
      },
    },
    {
      code: 'CAM-YARD-01',
      name: 'Yard Overview Camera',
      vendor: 'Dahua',
      model: 'IPC-HFW2431S',
      status: 'ONLINE',
      config: {
        streamUrl: '',
        embedUrl: '',
        snapshotUrl: '',
        zone: 'Yard',
        gridOrder: 2,
        nvrChannel: 'CH02',
      },
    },
    {
      code: 'CAM-WH-01',
      name: 'Warehouse Interior Camera',
      vendor: 'Hikvision',
      model: 'DS-2CD2387G2',
      status: 'ONLINE',
      config: {
        streamUrl: '',
        embedUrl: '',
        snapshotUrl: '',
        zone: 'Warehouse',
        gridOrder: 3,
        nvrChannel: 'CH03',
      },
    },
    {
      code: 'CAM-PARK-01',
      name: 'Parking Lot Camera',
      vendor: 'Dahua',
      model: 'IPC-HDW2431T',
      status: 'OFFLINE',
      config: {
        streamUrl: '',
        embedUrl: '',
        snapshotUrl: '',
        zone: 'Parking',
        gridOrder: 4,
        nvrChannel: 'CH04',
      },
    },
  ];

  const seededCameras: Record<string, { id: string }> = {};
  for (const cam of cctvCameras) {
    const row = await prisma.device.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: cam.code },
      },
      update: {
        name: cam.name,
        vendor: cam.vendor,
        model: cam.model,
        status: cam.status,
        siteId: site.id,
        gateId: cam.gateId ?? null,
        type: 'CCTV_CAMERA',
        connection: 'ONVIF',
        config: cam.config,
      },
      create: {
        organizationId: org.id,
        siteId: site.id,
        gateId: cam.gateId,
        type: 'CCTV_CAMERA',
        connection: 'ONVIF',
        code: cam.code,
        name: cam.name,
        vendor: cam.vendor,
        model: cam.model,
        status: cam.status,
        config: cam.config,
        createdBy: admin.id,
      },
    });
    seededCameras[cam.code] = { id: row.id };
  }

  const cctvEvents: Array<{
    dedupeKey: string;
    deviceCode: string;
    payload: Record<string, unknown>;
    minutesAgo: number;
  }> = [
    {
      dedupeKey: 'seed-cctv-intrusion-gate',
      deviceCode: 'CAM-GATE-01',
      minutesAgo: 12,
      payload: {
        event_type: 'INTRUSION',
        confidence: 0.91,
        snapshot_url: '',
        note: 'Demo AI alert — person in restricted zone near Main Gate (metadata only)',
        zone: 'Gate',
      },
    },
    {
      dedupeKey: 'seed-cctv-loitering-yard',
      deviceCode: 'CAM-YARD-01',
      minutesAgo: 45,
      payload: {
        event_type: 'LOITERING',
        confidence: 0.78,
        snapshot_url: '',
        note: 'Demo AI alert — loitering detected in yard',
        zone: 'Yard',
      },
    },
    {
      dedupeKey: 'seed-cctv-linecross-wh',
      deviceCode: 'CAM-WH-01',
      minutesAgo: 90,
      payload: {
        event_type: 'LINE_CROSSING',
        confidence: 0.86,
        snapshot_url: '',
        note: 'Demo AI alert — line crossing at warehouse aisle',
        zone: 'Warehouse',
      },
    },
  ];

  for (const ev of cctvEvents) {
    const deviceId = seededCameras[ev.deviceCode]?.id;
    if (!deviceId) continue;
    const capturedAt = new Date(Date.now() - ev.minutesAgo * 60_000);
    await prisma.deviceEvent.upsert({
      where: {
        organizationId_dedupeKey: {
          organizationId: org.id,
          dedupeKey: ev.dedupeKey,
        },
      },
      update: {
        payload: ev.payload,
        capturedAt,
        status: 'RECEIVED',
        deviceId,
        type: 'CCTV_EVENT',
      },
      create: {
        organizationId: org.id,
        deviceId,
        type: 'CCTV_EVENT',
        dedupeKey: ev.dedupeKey,
        payload: ev.payload,
        status: 'RECEIVED',
        capturedAt,
      },
    });
  }

  const shiftStart = new Date();
  shiftStart.setHours(shiftStart.getHours() + 1);
  const shiftEnd = new Date(shiftStart);
  shiftEnd.setHours(shiftEnd.getHours() + 8);

  const existingShift = await prisma.shift.findFirst({
    where: { organizationId: org.id, siteId: site.id, name: 'Day Shift Demo' },
  });
  if (!existingShift) {
    await prisma.shift.create({
      data: {
        organizationId: org.id,
        siteId: site.id,
        name: 'Day Shift Demo',
        startAt: shiftStart,
        endAt: shiftEnd,
        createdBy: admin.id,
        assignments: {
          create: [{ guardId: guardProfile.id }],
        },
      },
    });
  }

  async function ensureWorkflow(code: string, name: string) {
    const def = await prisma.workflowDefinition.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: {},
      create: {
        organizationId: org.id,
        code,
        name,
        description: `${name} workflow`,
      },
    });
    const ver = await prisma.workflowVersion.findFirst({
      where: { definitionId: def.id, isCurrent: true },
    });
    if (!ver) {
      await prisma.workflowVersion.create({
        data: {
          definitionId: def.id,
          version: 1,
          isCurrent: true,
          steps: {
            create: [
              {
                stepOrder: 1,
                name: 'General Manager Review',
                requiredRole: 'GENERAL_MANAGER',
                minApprovers: 1,
              },
            ],
          },
        },
      });
    }
  }

  await ensureWorkflow('contract-approval', 'Contract Approval');
  await ensureWorkflow('leave-approval', 'Leave Approval');
  await ensureWorkflow('loan-approval', 'Employee Loan Approval');
  await ensureWorkflow('payroll-approval', 'Payroll Approval');
  await ensureWorkflow('petty-cash-approval', 'Petty Cash Approval');
  await ensureWorkflow('payment-voucher-approval', 'Payment Voucher Approval');
  await ensureWorkflow('purchase-order-approval', 'Purchase Order Approval');
  await ensureWorkflow('employee-transfer-approval', 'Employee Transfer Approval');
  await ensureWorkflow('employee-exit-approval', 'Employee Exit Approval');

  // B3 contract-approval: Legal → GM → CEO → CMD (strategic @ ≥10M monthlyFee).
  // Dedicated bump — do not change shared ensureWorkflow (leave/loan stay GM-only).
  {
    const contractApprovalDesc =
      'Contract approval: Marketing/BD submits → Legal → GM → CEO → CMD (strategic if monthlyFee ≥ 10,000,000)';
    const def = await prisma.workflowDefinition.upsert({
      where: {
        organizationId_code: {
          organizationId: org.id,
          code: 'contract-approval',
        },
      },
      update: { description: contractApprovalDesc },
      create: {
        organizationId: org.id,
        code: 'contract-approval',
        name: 'Contract Approval',
        description: contractApprovalDesc,
      },
    });
    const ver = await prisma.workflowVersion.findFirst({
      where: { definitionId: def.id, isCurrent: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    const cmdThreshold = ver?.steps.find((s) => s.requiredRole === 'CMD')
      ?.amountThreshold;
    const multiOk =
      !!ver &&
      ver.steps.length === 4 &&
      ver.steps[0]?.requiredRole === 'LEGAL' &&
      ver.steps[1]?.requiredRole === 'GENERAL_MANAGER' &&
      ver.steps[2]?.requiredRole === 'CEO' &&
      ver.steps[3]?.requiredRole === 'CMD' &&
      cmdThreshold != null &&
      Number(cmdThreshold) === 10_000_000;
    if (!multiOk) {
      if (ver) {
        await prisma.workflowVersion.update({
          where: { id: ver.id },
          data: { isCurrent: false },
        });
      }
      await prisma.workflowVersion.create({
        data: {
          definitionId: def.id,
          version: (ver?.version ?? 0) + 1,
          isCurrent: true,
          steps: {
            create: [
              {
                stepOrder: 1,
                name: 'Legal Review',
                requiredRole: 'LEGAL',
                minApprovers: 1,
              },
              {
                stepOrder: 2,
                name: 'General Manager Review',
                requiredRole: 'GENERAL_MANAGER',
                minApprovers: 1,
              },
              {
                stepOrder: 3,
                name: 'CEO Approval',
                requiredRole: 'CEO',
                minApprovers: 1,
              },
              {
                stepOrder: 4,
                name: 'CMD Strategic Approval',
                requiredRole: 'CMD',
                minApprovers: 1,
                amountThreshold: 10_000_000,
              },
            ],
          },
        },
      });
    }
  }

  // Thin policy-change: CO drafts/submits; GM alone publishes (CEO/CMD deferred).
  // Avoid CO→GM two-step deadlock when the only CO is also the submitter (creator≠approver).
  {
    const def = await prisma.workflowDefinition.upsert({
      where: {
        organizationId_code: {
          organizationId: org.id,
          code: 'policy-change-approval',
        },
      },
      update: {
        description:
          'Thin policy change: Compliance Officer submits → GM publishes (CEO/CMD deferred)',
      },
      create: {
        organizationId: org.id,
        code: 'policy-change-approval',
        name: 'Policy Change Approval',
        description:
          'Thin policy change: Compliance Officer submits → GM publishes (CEO/CMD deferred)',
      },
    });
    const ver = await prisma.workflowVersion.findFirst({
      where: { definitionId: def.id, isCurrent: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    const thinOk =
      !!ver &&
      ver.steps.length === 1 &&
      ver.steps[0]?.requiredRole === 'GENERAL_MANAGER';
    if (!thinOk) {
      if (ver) {
        await prisma.workflowVersion.update({
          where: { id: ver.id },
          data: { isCurrent: false },
        });
      }
      await prisma.workflowVersion.create({
        data: {
          definitionId: def.id,
          version: (ver?.version ?? 0) + 1,
          isCurrent: true,
          steps: {
            create: [
              {
                stepOrder: 1,
                name: 'General Manager Approval',
                requiredRole: 'GENERAL_MANAGER',
                minApprovers: 1,
              },
            ],
          },
        },
      });
    }
  }

  // Demo published policy + reported breach (idempotent by unique codes).
  await prisma.policyDocument.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'POL-DPP-001',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      code: 'POL-DPP-001',
      title: 'Data Protection Policy',
      category: 'DATA_PROTECTION',
      summary: 'HIGHLINK baseline data protection and personal data handling rules.',
      body:
        'This policy sets out how HIGHLINK collects, processes, stores, and shares personal data in line with applicable data protection law. ' +
        'All staff must report suspected personal-data breaches to the Compliance / DPO register promptly.',
      version: 1,
      status: 'PUBLISHED',
      createdBy: admin.id,
      publishedAt: new Date(),
      publishedBy: admin.id,
    },
  });

  const existingBreach = await prisma.dataBreachCase.findFirst({
    where: {
      organizationId: org.id,
      referenceCode: 'BRCH-00001',
    },
  });
  if (!existingBreach) {
    await prisma.dataBreachCase.create({
      data: {
        organizationId: org.id,
        referenceCode: 'BRCH-00001',
        title: 'Demo — misplaced USB with staff contact list',
        description:
          'A USB drive containing a staff contact spreadsheet was reported missing from HQ admin. ' +
          'No evidence of external access yet; investigation opened for DPO register demo.',
        severity: 'MEDIUM',
        status: 'REPORTED',
        discoveredAt: new Date('2026-07-15T09:00:00.000Z'),
        affectedDataCategories: 'Staff contact details (names, phones, emails)',
        estimatedRecords: 120,
        createdBy: complianceUser.id,
      },
    });
  }

  const supplier = await prisma.supplier.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'SUP-UNIFORM' },
    },
    update: { status: 'APPROVED' },
    create: {
      organizationId: org.id,
      code: 'SUP-UNIFORM',
      name: 'Tanzania Uniform Supplies Ltd',
      email: 'orders@uniforms.co.tz',
      phone: '+255712345678',
      status: 'APPROVED',
      createdBy: admin.id,
    },
  });

  const stockItem = await prisma.stockItem.upsert({
    where: {
      organizationId_sku: { organizationId: org.id, sku: 'UNIFORM-L' },
    },
    update: {},
    create: {
      organizationId: org.id,
      sku: 'UNIFORM-L',
      name: 'Security Uniform — Large',
      category: 'UNIFORMS',
      unit: 'EA',
      reorderLevel: 10,
      createdBy: admin.id,
    },
  });

  const supplierPortalRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, code: 'SUPPLIER_PORTAL' },
  });

  await prisma.user.upsert({
    where: { email: 'portal@uniforms.co.tz' },
    update: { supplierId: supplier.id },
    create: {
      email: 'portal@uniforms.co.tz',
      fullName: 'Uniform Supplies Portal',
      passwordHash,
      organizationId: org.id,
      supplierId: supplier.id,
      roles: { create: [{ roleId: supplierPortalRole.id }] },
    },
  });

  const demoPo = await prisma.purchaseOrder.findFirst({
    where: {
      organizationId: org.id,
      supplierId: supplier.id,
      poNumber: 'PO-DEMO-UNIFORM-001',
    },
  });
  if (!demoPo) {
    await prisma.purchaseOrder.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        poNumber: 'PO-DEMO-UNIFORM-001',
        status: 'ORDERED',
        totalAmount: 400000,
        currency: 'TZS',
        createdBy: admin.id,
        lines: {
          create: [
            {
              description: 'Security Uniform — Large',
              quantity: 5,
              unitPrice: 80000,
              amount: 400000,
              stockItemId: stockItem.id,
            },
          ],
        },
      },
    });
  }

  const pettyFund = await prisma.pettyCashFund.findFirst({
    where: { organizationId: org.id, name: 'HQ Petty Cash' },
  });
  if (!pettyFund) {
    await prisma.pettyCashFund.create({
      data: {
        organizationId: org.id,
        name: 'HQ Petty Cash',
        imprestAmount: 500000,
        currentBalance: 500000,
        custodianId: admin.id,
        createdBy: admin.id,
      },
    });
  }

  // Demo customer invoices for Finance `/finance` roster (send + record payment)
  const invIssue = new Date();
  invIssue.setUTCHours(0, 0, 0, 0);
  const dueIn = (days: number) => {
    const d = new Date(invIssue);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };
  const contractByNumber = Object.fromEntries(
    (
      await prisma.contract.findMany({
        where: { organizationId: org.id, customerId: customer.id },
        select: { id: true, contractNumber: true },
      })
    ).map((c) => [c.contractNumber, c.id]),
  );
  const demoInvoices: {
    invoiceNumber: string;
    contractNumber?: string;
    status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
    total: number;
    paid: number;
    dueOffset: number;
    line: string;
  }[] = [
    {
      invoiceNumber: 'INV-DEMO-001',
      contractNumber: 'CTR-DEMO-GUARD-2026',
      status: 'DRAFT',
      total: 2_500_000,
      paid: 0,
      dueOffset: 30,
      line: 'Guard services — Warehouse A (draft)',
    },
    {
      invoiceNumber: 'INV-DEMO-002',
      contractNumber: 'CTR-DEMO-GUARD-2026',
      status: 'SENT',
      total: 4_800_000,
      paid: 0,
      dueOffset: 14,
      line: 'Monthly guard deployment — CUST-DEMO',
    },
    {
      invoiceNumber: 'INV-DEMO-003',
      contractNumber: 'CTR-DEMO-CCTV-2026',
      status: 'PARTIALLY_PAID',
      total: 3_600_000,
      paid: 1_200_000,
      dueOffset: 7,
      line: 'CCTV monitoring + access control',
    },
    {
      invoiceNumber: 'INV-DEMO-004',
      contractNumber: 'CTR-DEMO-VISITOR-2026',
      status: 'PAID',
      total: 1_500_000,
      paid: 1_500_000,
      dueOffset: -5,
      line: 'Visitor management service — prior period',
    },
    {
      invoiceNumber: 'INV-DEMO-005',
      contractNumber: 'CTR-DEMO-PARK-2026',
      status: 'OVERDUE',
      total: 980_000,
      paid: 0,
      dueOffset: -21,
      line: 'Parking + ANPR gate control — overdue',
    },
    {
      invoiceNumber: 'INV-DEMO-006',
      contractNumber: 'CTR-DEMO-VISITOR-2026',
      status: 'SENT',
      total: 650_000,
      paid: 0,
      dueOffset: -3,
      line: 'Visitor appointment & gate verification (past due → scan→OVERDUE)',
    },
  ];
  for (const inv of demoInvoices) {
    const contractId = inv.contractNumber
      ? (contractByNumber[inv.contractNumber] ?? null)
      : null;
    await prisma.invoice.upsert({
      where: {
        organizationId_invoiceNumber: {
          organizationId: org.id,
          invoiceNumber: inv.invoiceNumber,
        },
      },
      update: {
        customerId: customer.id,
        contractId,
        issueDate: invIssue,
        dueDate: dueIn(inv.dueOffset),
        subtotal: inv.total,
        taxAmount: 0,
        totalAmount: inv.total,
        amountPaid: inv.paid,
        status: inv.status,
        notes: 'Seed demo invoice for Customer + Finance portals',
      },
      create: {
        organizationId: org.id,
        customerId: customer.id,
        contractId,
        invoiceNumber: inv.invoiceNumber,
        issueDate: invIssue,
        dueDate: dueIn(inv.dueOffset),
        subtotal: inv.total,
        taxAmount: 0,
        totalAmount: inv.total,
        amountPaid: inv.paid,
        currency: 'TZS',
        status: inv.status,
        notes: 'Seed demo invoice for Customer + Finance portals',
        createdBy: admin.id,
        lines: {
          create: [
            {
              description: inv.line,
              quantity: 1,
              unitPrice: inv.total,
              amount: inv.total,
            },
          ],
        },
      },
    });
  }

  void supplier;
  void stockItem;

  await prisma.notificationTemplate.upsert({
    where: { code: 'VISITOR_GATE_CODE' },
    update: {},
    create: {
      code: 'VISITOR_GATE_CODE',
      channel: 'SMS',
      bodyTemplate:
        'HIGHLINK gate code: {{code}}. Valid until {{validUntil}}. Site: {{siteName}}',
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { code: 'FIELD_ALERT_MISSED' },
    update: {},
    create: {
      code: 'FIELD_ALERT_MISSED',
      channel: 'SMS',
      bodyTemplate: 'Field alert: {{message}}',
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { code: 'INVOICE_SENT' },
    update: {},
    create: {
      code: 'INVOICE_SENT',
      channel: 'EMAIL',
      subjectTemplate: 'Invoice {{invoiceNumber}}',
      bodyTemplate: 'Invoice {{invoiceNumber}} for {{amount}} has been sent.',
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { code: 'CUSTOMER_PORTAL_INVITE' },
    update: {},
    create: {
      code: 'CUSTOMER_PORTAL_INVITE',
      channel: 'EMAIL',
      subjectTemplate: 'HIGHLINK customer portal access — {{customerName}}',
      bodyTemplate:
        'You have been invited to the HIGHLINK customer portal. Sign in with the temporary password provided by your HIGHLINK administrator.',
    },
  });

  await prisma.notificationTemplate.upsert({
    where: { code: 'CONTRACT_EXPIRING' },
    update: {},
    create: {
      code: 'CONTRACT_EXPIRING',
      channel: 'EMAIL',
      subjectTemplate: 'Contract {{contractNumber}} is expiring',
      bodyTemplate:
        'Your HIGHLINK contract is marked EXPIRING. Contact your account manager to renew before the end date.',
    },
  });

  for (const p of [
    { code: 'console-sms', category: 'SMS' as const, adapterClass: 'ConsoleSmsProvider' },
    { code: 'console-payment', category: 'PAYMENT' as const, adapterClass: 'ConsolePaymentProvider' },
    { code: 'vision-ai-anpr', category: 'ANPR' as const, adapterClass: 'VisionAiAnprAdapter' },
  ]) {
    await prisma.providerRegistry.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  const kpiDefs = [
    { code: 'GUARD_HEADCOUNT_ACTIVE', name: 'Active guards', category: 'OPS', unit: 'COUNT' },
    { code: 'GUARD_ON_DUTY', name: 'Guards on duty', category: 'OPS', unit: 'COUNT' },
    { code: 'ATTENDANCE_CLOCK_INS', name: 'Clock-ins', category: 'OPS', unit: 'COUNT' },
    { code: 'ATTENDANCE_APPROVAL_RATE', name: 'Attendance approval rate', category: 'OPS', unit: 'PERCENT' },
    { code: 'ALERTNESS_CONFIRM_RATE', name: 'Alertness confirm rate', category: 'OPS', unit: 'PERCENT' },
    { code: 'FIELD_ALERTS_OPEN', name: 'Open field alerts', category: 'OPS', unit: 'COUNT' },
    { code: 'DEPLOYMENTS_ACTIVE', name: 'Active deployments', category: 'OPS', unit: 'COUNT' },
    { code: 'OPEN_INCIDENTS', name: 'Open incidents', category: 'SAFETY', unit: 'COUNT' },
    { code: 'INCIDENTS_BY_SEVERITY', name: 'Incidents by severity', category: 'SAFETY', unit: 'JSON' },
    { code: 'INCIDENTS_RESOLVED', name: 'Resolved incidents', category: 'SAFETY', unit: 'COUNT' },
    { code: 'VISITOR_APPOINTMENTS', name: 'Visitor appointments', category: 'ACCESS', unit: 'COUNT' },
    { code: 'VISITOR_ENTRIES_ALLOWED', name: 'Visitor entries allowed', category: 'ACCESS', unit: 'COUNT' },
    { code: 'PARKING_ENTRIES', name: 'Parking entries', category: 'ACCESS', unit: 'COUNT' },
    { code: 'PARKING_VIOLATIONS', name: 'Parking violations', category: 'ACCESS', unit: 'COUNT' },
    { code: 'CONTRACTS_ACTIVE', name: 'Active contracts', category: 'COMMERCIAL', unit: 'COUNT' },
    { code: 'CONTRACTS_MRR', name: 'Contract MRR', category: 'COMMERCIAL', unit: 'TZS' },
    { code: 'CUSTOMERS_ACTIVE', name: 'Active customers', category: 'COMMERCIAL', unit: 'COUNT' },
    { code: 'INVOICE_OUTSTANDING', name: 'Invoice outstanding', category: 'FINANCE', unit: 'TZS' },
    { code: 'INVOICE_COLLECTED', name: 'Payments collected', category: 'FINANCE', unit: 'TZS' },
    { code: 'PAYROLL_NET_TOTAL', name: 'Payroll net total', category: 'PAYROLL', unit: 'TZS' },
    { code: 'PAYROLL_GROSS_TOTAL', name: 'Payroll gross total', category: 'PAYROLL', unit: 'TZS' },
    { code: 'PAYROLL_CYCLES_PAID', name: 'Paid payroll cycles', category: 'PAYROLL', unit: 'COUNT' },
    { code: 'EMPLOYEES_ACTIVE', name: 'Active employees', category: 'HR', unit: 'COUNT' },
    { code: 'RECRUITMENT_PIPELINE', name: 'Recruitment pipeline', category: 'HR', unit: 'COUNT' },
  ];
  for (const k of kpiDefs) {
    await prisma.kpiDefinition.upsert({
      where: { code: k.code },
      update: { name: k.name, category: k.category, unit: k.unit },
      create: k,
    });
  }

  console.log('Seed complete');
  console.log('  admin@highlink.co.tz / ChangeMe123!');
  console.log('  gm@highlink.co.tz / ChangeMe123!');
  console.log('  portal@demo-mfg.co.tz / ChangeMe123! (CUSTOMER_PORTAL → CUST-DEMO)');
  console.log('  portal@uniforms.co.tz / ChangeMe123! (SUPPLIER_PORTAL → SUP-UNIFORM)');
  console.log('  guard1@highlink.co.tz / ChangeMe123! (guard profile GRD-0001)');
  console.log('  gate1@highlink.co.tz / ChangeMe123! (GATE_OFFICER)');
  console.log('  parking1@highlink.co.tz / ChangeMe123! (PARKING_OFFICER)');
  console.log('  supervisor1@highlink.co.tz / ChangeMe123! (SUPERVISOR + ESS office OFF-SUP-001)');
  console.log('  compliance1@highlink.co.tz / ChangeMe123! (COMPLIANCE_OFFICER)');
  console.log('  legal1@highlink.co.tz / ChangeMe123! (LEGAL — contract step 1)');
  console.log('  ceo@highlink.co.tz / ChangeMe123! (CEO — contract step 3)');
  console.log('  cmd@highlink.co.tz / ChangeMe123! (CMD — contract step 4 if fee ≥ 10M)');
  console.log('  marketing1@highlink.co.tz / ChangeMe123! (MARKETING — contract creator)');
  console.log('  Demo customer: CUST-DEMO, site SITE-WAREHOUSE-A, gates GATE-MAIN / GATE-VEHICLE');
  console.log('  Contracts↔Sites (B2): CTR-DEMO-* linked to SITE-WAREHOUSE-A / SITE-OFFICE-DEMO');
  console.log('  Demo employee: jane.doe@demo-mfg.co.tz, vehicle T123ABC permit PRM-DEMO-001');
  console.log('  Parking fleet demo: 10× CAR / MOTORCYCLE / TRUCK / BUS (+ ACTIVE permits)');
  console.log('  HR: employee GRD-0001 (John Guard), salary 850k TZS, job posting open');
  console.log('  Branch Ops: ACTIVE deployment GRD-0001 → SITE-WAREHOUSE-A under CTR-DEMO-GUARD-2026 (G2); G3 readiness GRD-0001 OK + firearm, GRD-0002 training only; open FieldAlert; today open attendance seed-branch-att-today-open; EOB demo ×2 at SITE-WAREHOUSE-A');
  console.log('  Customer portal ops: demo incidents INC-DEMO-00001/2/3/4 at SITE-WAREHOUSE-A (incl. CRITICAL RESOLVED for A4b close)');
  console.log('  Branch patrols A4a: Warehouse perimeter loop dueMinutes=0 + FieldAlert PATROL_MISSED (scan-missed / escalate on /branch/alerts)');
  console.log('  Customer portal guards: GRD-0001/2/3 → Warehouse A; GRD-0004 → SITE-OFFICE-DEMO');
  console.log('  CCTV: CAM-GATE-01 / CAM-YARD-01 / CAM-WH-01 / CAM-PARK-01 at SITE-WAREHOUSE-A + 3 CCTV_EVENT AI alerts (metadata only)');
  console.log('  ESS: AST-RADIO-001 assigned to GRD-0001 (request return → admin confirms)');
  console.log('  Integrations: console-sms, VISITOR_GATE_CODE template, service token ready');
  console.log('  Role DEVELOPER: integrations.manage + users.manage + audit.read + notifications.manage + operations.manage');
  console.log('  Role COMPLIANCE_OFFICER: compliance.manage + audit.read + approvals.act');
  console.log('  Roles LEGAL/CEO/CMD: contracts.manage + approvals.act + audit.read + customers.manage');
  console.log('  Role MARKETING: contracts.manage + customers.manage + documents.manage');
  console.log('  Compliance demo: policy POL-DPP-001 (PUBLISHED), breach BRCH-00001 (REPORTED)');
  console.log('  Workflow policy-change-approval: CO submits → GENERAL_MANAGER publishes');
  console.log('  Workflow contract-approval (B3): Legal → GM → CEO → CMD@10M monthlyFee');
  console.log('  Reporting: 24 KPI definitions seeded (executive dashboard)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
