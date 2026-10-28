import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

/**
 * Allocates the next free `EMP-####` (office) or `GRD-####` (guard) number for
 * an organization.
 *
 * Shared by Branch Ops staff creation and the self-service staff-profile
 * provisioning path so both surfaces agree on one numbering sequence.
 */
export async function nextEmployeeNumber(
  prisma: PrismaService,
  organizationId: string,
  prefix: 'EMP-' | 'GRD-' = 'EMP-',
): Promise<string> {
  const rows = await prisma.employee.findMany({
    where: { organizationId, employeeNumber: { startsWith: prefix } },
    select: { employeeNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  let max = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const row of rows) {
    const match = pattern.exec(row.employeeNumber);
    if (match) max = Math.max(max, Number(match[1]));
  }

  for (let i = 1; i <= 50; i += 1) {
    const candidate = `${prefix}${String(max + i).padStart(4, '0')}`;
    const taken = await prisma.employee.findFirst({
      where: { organizationId, employeeNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  throw new ConflictException({
    error: 'EMPLOYEE_NUMBER_GENERATION_FAILED',
    message: 'Could not allocate an employee number',
  });
}
