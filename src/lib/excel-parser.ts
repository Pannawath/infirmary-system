import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
import {checkZip} from './excel-students';
import {validateImportRows} from './student-import';

export type ExcelImportMapping = {
  studentCodeCol?: number;
  nameMode: 'single' | 'first_last' | 'prefix_first_last';
  fullNameCol?: number;
  prefixCol?: number;
  firstNameCol?: number;
  lastNameCol?: number;

  gradeMode?: 'column' | 'fixed';
  gradeLevelCol?: number;
  fixedGradeLevel?: string;

  classMode?: 'column' | 'fixed';
  classroomCol?: number;
  fixedClassroom?: string;

  rollNumberCol?: number;

  departmentMode?: 'column' | 'fixed';
  departmentCol?: number;
  fixedDepartment?: string;

  positionMode?: 'column' | 'fixed';
  positionCol?: number;
  fixedPosition?: string;
};

export type SheetConfig = {
  sheetName: string;
  headerRow: number;
  excludedRows: number[];
  excludedCols: number[];
  mapping: ExcelImportMapping;
  enabled?: boolean;
};

export type ExcelInspectionSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  previewRows: {
    rowNumber: number;
    cells: string[];
  }[];
  suggestedHeaderRow: number;
  suggestedColumns: Record<string, number>;
};

function readCellValue(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula) {
    if (typeof cell.result === 'string') {
      const res = cell.result.trim();
      if (/^#(?:REF!|VALUE!|N\/A|NAME\?|NUM!|DIV\/0!|NULL!)/.test(res)) {
        throw Error(`ช่อง ${cell.address} เป็นสูตรที่มีข้อผิดพลาด (${res}) กรุณาแก้ในไฟล์ Excel ก่อน`);
      }
      return res;
    } else if (typeof cell.result === 'number') {
      return String(cell.result);
    }
    const txt = cell.text.trim();
    if (/^#(?:REF!|VALUE!|N\/A|NAME\?|NUM!|DIV\/0!|NULL!)/.test(txt)) {
      throw Error(`ช่อง ${cell.address} เป็นสูตรที่มีข้อผิดพลาด (${txt}) กรุณาแก้ในไฟล์ Excel ก่อน`);
    }
    return txt;
  }
  return cell.text.trim();
}

export async function inspectExcelFile(buffer: Buffer): Promise<{sheets: ExcelInspectionSheet[]}> {
  checkZip(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheets: ExcelInspectionSheet[] = [];

  for (const sheet of workbook.worksheets) {
    const rowCount = sheet.rowCount;
    const colCount = Math.min(100, Math.max(sheet.columnCount, 1));

    const previewRows: ExcelInspectionSheet['previewRows'] = [];
    const maxSample = Math.min(120, rowCount);

    for (let r = 1; r <= maxSample; r++) {
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c++) {
        const cell = sheet.getCell(r, c);
        cells.push(cell.text?.trim() || '');
      }
      previewRows.push({rowNumber: r, cells});
    }

    let suggestedHeaderRow = 1;
    let suggestedColumns: Record<string, number> = {};

    for (let r = 1; r <= Math.min(15, rowCount); r++) {
      const labels = Array.from({length: colCount}, (_, c) => sheet.getCell(r, c + 1).text.trim());
      const find = (pattern: RegExp) => labels.findIndex(v => pattern.test(v)) + 1;

      const gradeLevel = find(/^(ชั้น|ระดับชั้น)$/);
      const classroom = find(/^ห้อง$/);
      const studentCodeFound = find(/^(รหัสนักเรียน|เลขประจำตัวนักเรียน)$/);
      const nameCol = find(/^(ชื่อ|ชื่อ.?นามสกุล|ชื่อ.?สกุล|ชื่อและนามสกุล)$/);

      if (studentCodeFound || (gradeLevel && classroom) || nameCol) {
        suggestedHeaderRow = r;
        suggestedColumns = {
          studentCode: studentCodeFound || 0,
          fullName: nameCol || 0,
          prefix: find(/^คำนำหน้า(?:ชื่อ)?$/) || 0,
          firstName: find(/^ชื่อ$/) || 0,
          lastName: find(/^นามสกุล$/) || 0,
          gradeLevel: gradeLevel || 0,
          classroom: classroom || 0,
          rollNumber: find(/^(เลขที่|ลำดับที่?)$/) || 0,
          position: find(/^ตำแหน่ง$/) || 0,
          department: find(/^(กลุ่มงาน|กลุ่มสาระ(?:การเรียนรู้)?|แผนก)$/) || 0,
        };
        break;
      }
    }

    sheets.push({
      name: sheet.name,
      rowCount,
      columnCount: colCount,
      previewRows,
      suggestedHeaderRow,
      suggestedColumns,
    });
  }

  return {sheets};
}

export type ParseGridOptions = {
  sheetConfigs?: SheetConfig[];
  sheetName?: string;
  headerRow?: number;
  excludedRows?: number[];
  excludedCols?: number[];
  mapping?: ExcelImportMapping;
  personType: 'STUDENT' | 'STAFF';
};

export async function parseExcelGrid(
  buffer: Buffer,
  options: ParseGridOptions
) {
  checkZip(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const configs: SheetConfig[] = options.sheetConfigs && options.sheetConfigs.length > 0
    ? options.sheetConfigs.filter(cfg => cfg.enabled !== false)
    : [
        {
          sheetName: options.sheetName || workbook.worksheets[0]?.name || '',
          headerRow: options.headerRow || 1,
          excludedRows: options.excludedRows || [],
          excludedCols: options.excludedCols || [],
          mapping: options.mapping!,
          enabled: true,
        },
      ];

  const allRows: Record<string, string>[] = [];
  const personType = options.personType;

  for (const cfg of configs) {
    const sheet = workbook.getWorksheet(cfg.sheetName);
    if (!sheet) continue;

    const excludedRowSet = new Set(cfg.excludedRows || []);
    excludedRowSet.add(cfg.headerRow);

    const startRow = cfg.headerRow + 1;
    const endRow = sheet.rowCount;
    const mapping = cfg.mapping;

    for (let r = startRow; r <= endRow; r++) {
      if (excludedRowSet.has(r)) continue;

      const getColText = (colIndex?: number) => {
        if (!colIndex || colIndex < 1) return '';
        return readCellValue(sheet.getCell(r, colIndex));
      };

      const studentCode = getColText(mapping.studentCodeCol);

      let fullName = '';
      if (mapping.nameMode === 'single') {
        fullName = getColText(mapping.fullNameCol);
      } else if (mapping.nameMode === 'first_last') {
        const first = getColText(mapping.firstNameCol);
        const last = getColText(mapping.lastNameCol);
        fullName = [first, last].filter(Boolean).join(' ');
      } else if (mapping.nameMode === 'prefix_first_last') {
        const prefix = getColText(mapping.prefixCol);
        const first = getColText(mapping.firstNameCol);
        const last = getColText(mapping.lastNameCol);
        const combinedFirst = (prefix + first).trim();
        fullName = [combinedFirst, last].filter(Boolean).join(' ');
      }

      fullName = fullName.replace(/\s+/g, ' ').trim();

      const gradeLevel = mapping.gradeMode === 'fixed'
        ? (mapping.fixedGradeLevel?.trim() || (personType === 'STAFF' ? 'บุคลากร' : ''))
        : getColText(mapping.gradeLevelCol);

      const classroom = mapping.classMode === 'fixed'
        ? (mapping.fixedClassroom?.trim() || (personType === 'STAFF' ? cfg.sheetName : ''))
        : getColText(mapping.classroomCol);

      const rollNumber = getColText(mapping.rollNumberCol);

      const department = mapping.departmentMode === 'fixed'
        ? (mapping.fixedDepartment?.trim() || cfg.sheetName)
        : (getColText(mapping.departmentCol) || cfg.sheetName);

      const position = mapping.positionMode === 'fixed'
        ? (mapping.fixedPosition?.trim() || '')
        : getColText(mapping.positionCol);

      if (!studentCode && !fullName && !gradeLevel && !classroom) {
        continue;
      }

      if (personType === 'STAFF') {
        const staffCode = studentCode || `STAFF-AUTO-${createHash('sha256').update(`${cfg.sheetName}-${r}-${fullName.replace(/\s/g, '')}`).digest('hex').slice(0, 16)}`;
        allRows.push({
          studentCode: staffCode,
          fullName,
          personType: 'STAFF',
          department: department || cfg.sheetName,
          position,
          gradeLevel: gradeLevel || 'บุคลากร',
          classroom: classroom || department || cfg.sheetName,
          rollNumber: '',
        });
      } else {
        allRows.push({
          studentCode,
          fullName,
          personType: 'STUDENT',
          gradeLevel,
          classroom,
          rollNumber,
        });
      }
    }
  }

  return {rows: validateImportRows(allRows)};
}
