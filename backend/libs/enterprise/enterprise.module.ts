import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { BranchesService } from './application/branches.service';
import { SitesService } from './application/sites.service';
import { DepartmentsService } from './application/departments.service';
import { GatesService } from './application/gates.service';
import { OrganizationService } from './application/organization.service';
import { BranchesController } from './presentation/branches.controller';
import { SitesController } from './presentation/sites.controller';
import { DepartmentsController } from './presentation/departments.controller';
import { OrganizationController } from './presentation/organization.controller';
import { GatesController } from './presentation/gates.controller';

@Module({
  imports: [AuditModule],
  controllers: [
    OrganizationController,
    BranchesController,
    DepartmentsController,
    SitesController,
    GatesController,
  ],
  providers: [
    OrganizationService,
    BranchesService,
    DepartmentsService,
    SitesService,
    GatesService,
  ],
  exports: [OrganizationService, BranchesService, SitesService, GatesService],
})
export class EnterpriseModule {}
