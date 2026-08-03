import { findByProps } from "@vendetta/metro";
import { Forms } from "@vendetta/ui/components";

/**
 * Discord's redesigned "Table" row family (TableRow/TableRowGroup/TableSwitchRow/...) replaced
 * the old Forms.Form* components in the app itself a while ago - Forms.* still works (Vendetta's
 * compat layer maps it to the legacy components, see metro/common/components.ts in the loader),
 * but it's the deprecated skin. These are found the same way ViewRaw finds ActionSheetRow: a
 * direct findByProps lookup for the real component, since the vendetta.ui.components compat
 * object never exposed the Table family at all. Falls back to the matching legacy Form
 * component if a lookup ever comes back empty, same "isolate the failure" approach as the rest
 * of this repo - the fallback's prop names don't perfectly match (e.g. `icon` vs `leading`), so a
 * few things would render without an icon/arrow in that fallback path, but nothing crashes.
 */
const find = (prop: string): any => findByProps(prop)?.[prop];

const RealTableRow: any = find("TableRow");

export const TableRow: any = RealTableRow ?? Forms.FormRow;
export const TableRowGroup: any = find("TableRowGroup") ?? Forms.FormSection;
export const TableSwitchRow: any = find("TableSwitchRow") ?? Forms.FormSwitchRow;
export const TableRadioRow: any = find("TableRadioRow") ?? Forms.FormRadioRow;
export const TableRadioGroup: any = find("TableRadioGroup") ?? Forms.FormRadioGroup;
export const TableCheckboxRow: any = find("TableCheckboxRow") ?? Forms.FormCheckboxRow;
export const TextInput: any = find("TextInput") ?? Forms.FormInput;

export const TableRowIcon: any = RealTableRow?.Icon ?? Forms.FormRow.Icon;
export const TableRowArrow: any = RealTableRow?.Arrow ?? Forms.FormRow.Arrow;
export const TableRowTrailingText: any = RealTableRow?.TrailingText;
