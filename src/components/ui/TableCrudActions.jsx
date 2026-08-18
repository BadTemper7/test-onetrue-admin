import { Eye, Pencil, Trash2 } from "lucide-react"
import TableActionButton from "./TableActionButton"

const TableCrudActions = ({
  recordLabel = "record",
  onView,
  onEdit,
  onDelete,
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  viewLabel,
  editLabel,
  deleteLabel,
  deleting = false,
  children,
  className = "",
}) => {
  const safeLabel = String(recordLabel || "record")

  return (
    <div className={`flex flex-wrap justify-end gap-2 ${className}`}>
      <TableActionButton
        label={viewLabel || `View ${safeLabel}`}
        variant="dark"
        disabled={viewDisabled || typeof onView !== "function"}
        onClick={onView}
      >
        <Eye size={17} aria-hidden="true" />
      </TableActionButton>

      <TableActionButton
        label={editLabel || `Edit ${safeLabel}`}
        variant="info"
        disabled={editDisabled || typeof onEdit !== "function"}
        onClick={onEdit}
      >
        <Pencil size={17} aria-hidden="true" />
      </TableActionButton>

      <TableActionButton
        label={deleteLabel || `Delete ${safeLabel}`}
        variant="danger"
        disabled={deleteDisabled || typeof onDelete !== "function"}
        loading={deleting}
        onClick={onDelete}
      >
        <Trash2 size={17} aria-hidden="true" />
      </TableActionButton>

      {children}
    </div>
  )
}

export default TableCrudActions
