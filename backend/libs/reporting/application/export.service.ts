import { Injectable } from '@nestjs/common';
import { KpiPeriodGranularity } from '@prisma/client';
import { AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ExecutiveDashboardQueryDto } from '../presentation/dto/reporting.dto';
import { KpiItemDto } from '../presentation/dto/reporting.dto';
import { KpiService } from './kpi.service';

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

interface ExportContext {
  items: KpiItemDto[];
  from: Date;
  to: Date;
  granularity: KpiPeriodGranularity;
  filters: { siteId?: string; branchId?: string };
}

@Injectable()
export class ExportService {
  constructor(
    private readonly kpis: KpiService,
    private readonly audit: AuditService,
  ) {}

  async executiveDashboardCsv(
    query: ExecutiveDashboardQueryDto,
    user: AuthUser,
  ): Promise<string> {
    const ctx = await this.buildContext(query, user);
    const header =
      'code,name,category,unit,value,source,as_of,period_from,period_to';
    const rows = ctx.items.map((kpi) =>
      [
        csvEscape(kpi.code),
        csvEscape(kpi.name),
        csvEscape(kpi.category),
        csvEscape(kpi.unit),
        String(kpi.value),
        csvEscape(kpi.source),
        csvEscape(new Date(kpi.asOf).toISOString()),
        csvEscape(ctx.from.toISOString().slice(0, 10)),
        csvEscape(ctx.to.toISOString().slice(0, 10)),
      ].join(','),
    );

    await this.auditExport(user, 'reporting.export.csv', ctx, rows.join('\n').length + header.length);
    return [header, ...rows].join('\n');
  }

  async executiveDashboardXlsx(
    query: ExecutiveDashboardQueryDto,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ctx = await this.buildContext(query, user);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Executive KPIs');

    sheet.addRow(['HIGHLINK Executive Dashboard']);
    sheet.addRow([
      `Period: ${ctx.from.toISOString().slice(0, 10)} — ${ctx.to.toISOString().slice(0, 10)}`,
    ]);
    sheet.addRow([]);
    const header = sheet.addRow([
      'code',
      'name',
      'category',
      'unit',
      'value',
      'source',
      'as_of',
    ]);
    header.font = { bold: true };

    for (const kpi of ctx.items) {
      sheet.addRow([
        kpi.code,
        kpi.name,
        kpi.category,
        kpi.unit,
        kpi.value,
        kpi.source,
        new Date(kpi.asOf).toISOString(),
      ]);
    }

    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const date = new Date().toISOString().slice(0, 10);

    await this.auditExport(user, 'reporting.export.xlsx', ctx, buffer.length);

    return {
      buffer,
      filename: `executive-dashboard-${date}.xlsx`,
    };
  }

  async executiveDashboardPdf(
    query: ExecutiveDashboardQueryDto,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ctx = await this.buildContext(query, user);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('HIGHLINK Executive Dashboard', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .fillColor('#444444')
        .text(
          `Period: ${ctx.from.toISOString().slice(0, 10)} — ${ctx.to.toISOString().slice(0, 10)}`,
          { align: 'center' },
        );
      doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#000000').fontSize(9);

      const colWidths = [90, 160, 55, 45, 70];
      const startX = 50;
      let y = doc.y;

      const drawRow = (cells: string[], bold = false) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        let x = startX;
        cells.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i], lineBreak: false });
          x += colWidths[i];
        });
        y += 14;
      };

      drawRow(['Code', 'Name', 'Value', 'Unit', 'Source'], true);
      for (const kpi of ctx.items) {
        drawRow([
          kpi.code,
          kpi.name.slice(0, 28),
          String(kpi.value),
          kpi.unit,
          kpi.source,
        ]);
      }

      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text('HIGHLINK PSSMS — Payroll KPIs from immutable PayslipSnapshot.', {
          align: 'center',
        });
      doc.end();
    });

    const date = new Date().toISOString().slice(0, 10);
    await this.auditExport(user, 'reporting.export.pdf', ctx, buffer.length);

    return {
      buffer,
      filename: `executive-dashboard-${date}.pdf`,
    };
  }

  private async buildContext(
    query: ExecutiveDashboardQueryDto,
    user: AuthUser,
  ): Promise<ExportContext> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    const granularity = query.granularity ?? KpiPeriodGranularity.DAY;
    const filters = { siteId: query.siteId, branchId: query.branchId };

    const items = await this.kpis.computeAll(
      user.organizationId,
      from,
      to,
      undefined,
      filters,
    );

    return { items, from, to, granularity, filters };
  }

  private async auditExport(
    user: AuthUser,
    action: string,
    ctx: ExportContext,
    fileSizeBytes: number,
  ) {
    const format = action.split('.').pop() ?? 'unknown';
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action,
      resourceType: 'ExecutiveDashboard',
      resourceId: user.organizationId,
      after: {
        format,
        rowCount: ctx.items.length,
        fileSizeBytes,
        period: {
          from: ctx.from.toISOString().slice(0, 10),
          to: ctx.to.toISOString().slice(0, 10),
          granularity: ctx.granularity,
        },
        filters: ctx.filters,
      },
    });
  }
}
