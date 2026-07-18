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
    { code: 'recruitment.manage', name: 'Manage recruitment', module: 'recruitment' },
    { code: 'payroll.manage', name: 'Manage payroll', module: 'payroll' },
    { code: 'loans.manage', name: 'Manage employee loans', module: 'employee-loans' },
    { code: 'finance.manage', name: 'Manage finance', module: 'finance' },
    { code: 'procurement.manage', name: 'Manage procurement', module: 'procurement' },
    { code: 'inventory.manage', name: 'Manage inventory', module: 'inventory' },
    { code: 'assets.manage', name: 'Manage assets', module: 'assets' },
    { code: 'notifications.manage', name: 'Manage notifications', module: 'notifications' },
    { code: 'reporting.read', name: 'Read executive reports', module: 'reporting' },
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

  await prisma.user.upsert({
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
    update: {},
    create: {
      organizationId: org.id,
      code: 'CUST-DEMO',
      name: 'Demo Manufacturing Ltd',
      email: 'security@demo-mfg.co.tz',
      phone: '+255755000001',
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

  await prisma.user.upsert({
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

  const existingBlacklist = await prisma.vehicleBlacklist.findFirst({
    where: {
      organizationId: org.id,
      plateNumber: 'BLACKLIST1',
    },
  });
  if (!existingBlacklist) {
    await prisma.vehicleBlacklist.create({
      data: {
        organizationId: org.id,
        plateNumber: 'BLACKLIST1',
        reason: 'Demo blacklist plate',
        createdBy: admin.id,
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
    update: { deploymentEligible: true },
    create: {
      organizationId: org.id,
      userId: guardUser.id,
      employeeNumber: 'GRD-0001',
      deploymentEligible: true,
      phone: '+255712345678',
    },
  });

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

  const existingPendingAlertness = await prisma.alertnessCheck.findFirst({
    where: { referenceNumber: 'ALT-DEMO-PENDING' },
  });
  if (!existingPendingAlertness) {
    await prisma.alertnessCheck.create({
      data: {
        organizationId: org.id,
        guardId: guardProfile.id,
        siteId: site.id,
        scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
        status: 'SCHEDULED',
        referenceNumber: 'ALT-DEMO-PENDING',
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
    update: { guardProfileId: guardProfile.id },
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

  void gate;
  void vehicleGate;
  void customerEmployee;

  await prisma.checkpoint.upsert({
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

  // silence unused enum import warning in some tooling
  void ContractStatus.DRAFT;
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
  console.log('  supervisor1@highlink.co.tz / ChangeMe123! (SUPERVISOR)');
  console.log('  Demo customer: CUST-DEMO, site SITE-WAREHOUSE-A, gates GATE-MAIN / GATE-VEHICLE');
  console.log('  Demo employee: jane.doe@demo-mfg.co.tz, vehicle T123ABC permit PRM-DEMO-001');
  console.log('  HR: employee GRD-0001 (John Guard), salary 850k TZS, job posting open');
  console.log('  Integrations: console-sms, VISITOR_GATE_CODE template, service token ready');
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
