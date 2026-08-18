const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;")

const money = (value) => `PHP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const date = (value) => value ? new Date(value).toLocaleString("en-PH") : "-"
const dateOnly = (value) => value ? new Date(value).toLocaleDateString("en-PH") : "-"
const timeOnly = (value) => value ? new Date(value).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "-"
const buildRows = (items = []) => items.map((item) => `
  <tr>
    <td>${escapeHtml(item.description || item.chargeCode || "Charge")}</td>
    <td class="right">${escapeHtml(Number(item.quantity || 0).toLocaleString())}</td>
    <td class="right">${money(item.rateAmount)}</td>
    <td class="right">${money(item.amount)}</td>
  </tr>
`).join("")

const CONDITION_OPTIONS = ["GOOD", "DENTED", "RUST", "HOLE", "DOOR DAMAGE", "OTHER"]

const normalizeConditions = (booking, type) => {
  const values = type === "gateOut"
    ? booking.gateOutConditions || booking.gateInConditions || []
    : booking.gateInConditions || []

  const list = Array.isArray(values) ? values : values ? [values] : []
  const normalized = list.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
  if (normalized.length) return normalized

  const legacy = String(booking.physicalCondition || "").toUpperCase()
  if (!legacy) return ["GOOD"]
  return CONDITION_OPTIONS.filter((option) => legacy.includes(option))
}

const getConditionOther = (booking, type) => {
  const direct = type === "gateOut" ? booking.gateOutConditionOther : booking.gateInConditionOther
  if (direct) return direct
  const legacy = String(booking.physicalCondition || "")
  const match = legacy.match(/OTHER\s*:\s*(.*)$/i)
  return match?.[1] || ""
}

const formatContainerType = (value) => String(value || "")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase())

const formatLoadStatus = (value) => {
  if (String(value || "").toLowerCase() === "laden") return "LOADED"
  if (String(value || "").toLowerCase() === "empty") return "EMPTY"
  return String(value || "-").toUpperCase()
}

const formatSealIntact = (value) => {
  const normalized = String(value || "").toLowerCase()
  if (normalized === "yes") return { yes: true, no: false }
  if (normalized === "no") return { yes: false, no: true }
  return { yes: false, no: false }
}

const checkbox = (checked) => checked ? "☑" : "☐"

const printableColorBand = (label, className, color) => `
  <div class="${className} print-color-band">
    <svg class="print-color-band-fill" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="10" height="10" fill="${color}"></rect>
    </svg>
    <span class="print-color-band-text">${escapeHtml(label)}</span>
  </div>
`

const buildGatePassHtml = (booking, type) => {
  const isGateIn = type === "gateIn"
  const eventAt = isGateIn
    ? booking.gateInApprovedAt || booking.inDate || booking.createdAt
    : booking.releasedAt || booking.gateOutApprovedAt || booking.gateOutRequestedAt || booking.updatedAt
  const passTitle = isGateIn ? "GATE-IN PASS" : "GATE-OUT PASS"
  const passColor = isGateIn ? "#9aca3c" : "#72a6ef"
  const passNumber = isGateIn
    ? booking.gateInPassNumber || `GIN-${booking.bookingReference || booking.bookingNumber || booking.id || "0001"}`
    : booking.gateOutPassNumber || `GOUT-${booking.bookingReference || booking.bookingNumber || booking.id || "0001"}`
  const conditions = normalizeConditions(booking, type)
  const otherCondition = getConditionOther(booking, type)
  const sealIntact = formatSealIntact(booking.sealIntact)
  const processedBy = isGateIn
    ? booking.gateInApprovedByName || booking.approvedByName || ""
    : booking.releasedByName || booking.gateOutApprovedByName || ""
  const authorizedBy = booking.gateOutApprovedByName || booking.releasedByName || ""
  const releaseOrderNo = `RO-${booking.bookingReference || booking.bookingNumber || booking.id || "0001"}`
  const bookingNo = booking.bookingNumber || booking.bookingReference || ""
  const containerNo = booking.actualContainerNumber || booking.containerNumber || ""
  const sizeType = `${booking.containerSize || "-"} FT / ${formatContainerType(booking.containerType || "-")}`
  const remarks = isGateIn ? (booking.inspectionRemarks || booking.clientRemarks || "") : (booking.releaseRemarks || booking.gateOutRemarks || "")
  const conditionLabel = isGateIn ? "CONTAINER CONDITION UPON ENTRY" : "CONTAINER CONDITION UPON RELEASE"
  const footerText = isGateIn
    ? "The driver/hauler acknowledges that the above container was delivered to One True Yard in the condition indicated above. Any pre-existing damages not noted on this Gate-in Pass shall be deemed absent upon acceptance."
    : "The driver confirms receipt of the container in the recorded condition. Upon gate-out, One True Yard is released from liability for any loss, damage, or discrepancy not documented on this Gate-Out Pass."

  return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(passTitle)} - ${escapeHtml(passNumber)}</title>
  <style>
    html,body,body *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff;color:#404040;margin:0;padding:18px}
    .no-print{margin-bottom:14px}
    .sheet{max-width:980px;margin:0 auto;border:2px solid #e5b8b8;padding:16px 18px 22px}
    .header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
    .brand-wrap{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}
    .logo{width:78px;height:auto;object-fit:contain}
    .title-bar{flex:1;border:2px solid #c8d39c;text-align:center;font-size:20px;font-weight:700;letter-spacing:.06em;line-height:1.1;min-height:44px}
    .print-color-band{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center}
    .print-color-band-fill{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block}
    .print-color-band-text{position:relative;z-index:1;display:block;width:100%;color:#fff!important}
    .title-bar .print-color-band-text{padding:8px 12px}
    .meta{width:230px;font-size:13px}
    .meta .number{font-weight:700;text-align:right;margin-bottom:8px;color:#d87f7f}
    .meta-row{display:grid;grid-template-columns:64px 1fr;border:1px solid #cdbcbc;border-bottom:none}
    .meta-row:last-child{border-bottom:1px solid #cdbcbc}
    .meta-label,.meta-value{padding:6px 8px;min-height:30px}
    .meta-label{font-weight:700;color:#6e6e6e;background:#fff}
    .section-title{margin-top:10px;font-weight:700;font-size:14px;border:1px solid #cdbcbc;border-bottom:none;min-height:31px}
    .section-title .print-color-band-text{padding:6px 8px;text-align:left}
    table.form{width:100%;border-collapse:collapse;font-size:13px}
    table.form td{border:1px solid #cdbcbc;padding:6px 8px;height:31px;vertical-align:middle}
    td.label{width:26%;font-weight:700;color:#6e6e6e;background:#fff}
    td.value{width:24%}
    .cond-row{display:flex;flex-wrap:wrap;gap:18px 24px;padding:8px 8px;border:1px solid #cdbcbc;border-top:none;font-size:13px}
    .cond-item{white-space:nowrap}
    .remarks{border:1px solid #cdbcbc;border-top:none;min-height:44px;padding:8px;font-size:13px}
    .footer-note{margin-top:22px;font-size:12px;color:#6b6b6b;line-height:1.45;text-align:center}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:24px;padding:0 10px}
    .sig{text-align:center;font-size:12px;color:#666}
    .sig-line{border-bottom:1px solid #b9b9b9;min-height:36px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;font-weight:700;color:#444}
    .sig-label{margin-top:10px;font-weight:700;letter-spacing:.03em}
    .sig-role{margin-top:2px;font-weight:700;color:#777}
    .tight td{height:28px}
    @media print{
      @page{size:auto;margin:10mm}
      html,body,body *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
      body{padding:0}
      .no-print{display:none}
      .sheet{border:none;max-width:none;padding:10px 14px 18px}
      .print-color-band-fill{display:block!important;visibility:visible!important;opacity:1!important}
      .print-color-band-text{color:#fff!important}
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="sheet">
    <div class="header">
      <div class="brand-wrap">
        <img class="logo" src="${window.location.origin}/images/logo.png" alt="One True Logistics logo" />
        ${printableColorBand(passTitle, "title-bar", passColor)}
      </div>
      <div class="meta">
        <div class="number">No. ${escapeHtml(passNumber)}</div>
        <div class="meta-row"><div class="meta-label">DATE:</div><div class="meta-value">${escapeHtml(dateOnly(eventAt))}</div></div>
        <div class="meta-row"><div class="meta-label">TIME:</div><div class="meta-value">${escapeHtml(timeOnly(eventAt))}</div></div>
      </div>
    </div>

    ${printableColorBand("TRUCK / DRIVER INFORMATION", "section-title", passColor)}
    <table class="form tight">
      <tr><td class="label">TRUCK PLATE NO.:</td><td class="value">${escapeHtml(booking.truckPlateNumber || "")}</td><td class="label">DRIVER LICENSE NO.:</td><td class="value">${escapeHtml(booking.driverLicenseNumber || "")}</td></tr>
      <tr><td class="label">DRIVER NAME:</td><td class="value">${escapeHtml(booking.driverName || "")}</td><td class="label">HAULER:</td><td class="value">${escapeHtml(booking.hauler || "")}</td></tr>
      ${isGateIn ? `<tr><td class="label">BOOKING NO.:</td><td class="value" colspan="3">${escapeHtml(bookingNo)}</td></tr>` : ""}
    </table>

    ${isGateIn ? "" : `${printableColorBand("RELEASE AUTHORIZATION", "section-title", passColor)}
    <table class="form tight">
      <tr><td class="label">AUTHORIZED BY:</td><td class="value">${escapeHtml(authorizedBy)}</td><td class="label">BOOKING NO.:</td><td class="value">${escapeHtml(bookingNo)}</td></tr>
      <tr><td class="label">RELEASE ORDER NO.:</td><td class="value">${escapeHtml(releaseOrderNo)}</td><td class="label"></td><td class="value"></td></tr>
    </table>`}

    ${printableColorBand("CONTAINER INFORMATION", "section-title", passColor)}
    <table class="form tight">
      <tr><td class="label">CONTAINER NO.:</td><td class="value">${escapeHtml(containerNo)}</td><td class="label">SEAL NO.:</td><td class="value">${escapeHtml(booking.sealNumber || "")}</td></tr>
      <tr><td class="label">SIZE / TYPE:</td><td class="value">${escapeHtml(sizeType)}</td><td class="label">SEAL INTACT:</td><td class="value">${checkbox(sealIntact.yes)} YES &nbsp;&nbsp; ${checkbox(sealIntact.no)} NO</td></tr>
      <tr><td class="label">EMPTY / LOADED:</td><td class="value">${escapeHtml(formatLoadStatus(booking.containerLoadStatus))}</td><td class="label">SHIPPING LINE:</td><td class="value">${escapeHtml(booking.shippingLine || "")}</td></tr>
    </table>

    ${printableColorBand(conditionLabel, "section-title", passColor)}
    <div class="cond-row">
      ${CONDITION_OPTIONS.map((option) => {
        const checked = conditions.includes(option)
        const label = option === "OTHER" ? `OTHER${otherCondition ? `: ${escapeHtml(otherCondition)}` : ""}` : option
        return `<div class="cond-item">${checkbox(checked)} ${label}</div>`
      }).join("")}
    </div>

    ${printableColorBand("REMARKS", "section-title", passColor)}
    <div class="remarks">${escapeHtml(remarks)}</div>

    <div class="footer-note">${escapeHtml(footerText)}</div>

    <div class="signatures">
      <div class="sig">
        <div class="sig-line">${escapeHtml(processedBy)}</div>
        <div class="sig-label">NAME AND SIGNATURE</div>
        <div class="sig-role">YARD CHECKER</div>
      </div>
      <div class="sig">
        <div class="sig-line">${escapeHtml(booking.driverName || "")}</div>
        <div class="sig-label">NAME AND SIGNATURE</div>
        <div class="sig-role">DRIVER</div>
      </div>
    </div>
  </div>
  <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
</body>
</html>`
}

export const printBookingDocument = (booking, type = "invoice") => {
  if (!booking) return
  const documentType = type === "gateIn" ? "Gate-In Pass" : type === "gateOut" ? "Gate-Out Pass" : type === "receipt" ? (booking.receiptType === "acknowledgement_receipt" ? "Acknowledgement Receipt" : "Official Receipt") : "Invoice"
  const number = type === "receipt" ? booking.receiptNumber || booking.paymentReferenceNumber : booking.bookingReference
  const lineItems = booking.billingLineItems || booking.lineItems || []
  const popup = window.open("", "_blank", "width=960,height=900")
  if (!popup) return

  if (["gateIn", "gateOut"].includes(type)) {
    popup.document.write(buildGatePassHtml(booking, type))
    popup.document.close()
    return
  }

  popup.document.write(`<!doctype html>
<html><head><title>${escapeHtml(documentType)} - ${escapeHtml(number)}</title>
<style>
  html,body,body *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#14213d;margin:0;padding:32px;background:#fff}
  .top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #087a55;padding-bottom:18px}.brand{font-size:25px;font-weight:800}.muted{color:#64748b;font-size:12px}.title{text-align:right}.title h1{margin:0;font-size:24px}.number{margin-top:5px;font-weight:700;color:#087a55}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}.box{border:1px solid #dbe3ea;border-radius:8px;padding:12px}.label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700}.value{margin-top:5px;font-size:14px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.06em}.right{text-align:right}.totals{margin-left:auto;margin-top:16px;width:330px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:18px;font-weight:800;border-top:2px solid #087a55;margin-top:5px;padding-top:10px!important}.footer{margin-top:36px;border-top:1px solid #e2e8f0;padding-top:14px;color:#64748b;font-size:11px}.no-print{margin-bottom:20px}@media print{@page{size:auto;margin:10mm}html,body,body *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}body{padding:16px}.no-print{display:none}th{background:#f1f5f9!important;box-shadow:inset 0 0 0 1000px #f1f5f9!important}}
</style></head><body>
<button class="no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="top"><div><div class="brand">One True Logistics Inc.</div><div class="muted">Container Yard Management System</div></div><div class="title"><h1>${escapeHtml(documentType)}</h1><div class="number">${escapeHtml(number || "Pending")}</div><div class="muted">Generated ${escapeHtml(new Date().toLocaleString("en-PH"))}</div></div></div>
<div class="grid">
  <div class="box"><div class="label">Client</div><div class="value">${escapeHtml(booking.clientName || "-")}</div><div class="muted">${escapeHtml(booking.clientEmail || "")}</div></div>
  <div class="box"><div class="label">Booking / Container</div><div class="value">${escapeHtml(booking.bookingReference || "-")} / ${escapeHtml(booking.containerNumber || "-")}</div><div class="muted">${escapeHtml(booking.containerSize || "-")} FT • ${escapeHtml(String(booking.containerType || "").replaceAll("_", " "))}</div></div>
  <div class="box"><div class="label">Gate-In</div><div class="value">${escapeHtml(date(booking.gateInApprovedAt || booking.inDate))}</div><div class="muted">Driver: ${escapeHtml(booking.driverName || "-")} • Truck: ${escapeHtml(booking.truckPlateNumber || "-")}</div></div>
  <div class="box"><div class="label">Gate-Out / Release</div><div class="value">${escapeHtml(date(booking.releasedAt || booking.gateOutApprovedAt || booking.outDate))}</div><div class="muted">Slot: ${escapeHtml(booking.assignedSlotNumber || "-")}</div></div>
</div>
${["invoice","receipt"].includes(type) ? `<table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead><tbody>${buildRows(lineItems) || `<tr><td colspan="4">No billing line items</td></tr>`}</tbody></table>
<div class="totals"><div><span>Subtotal</span><strong>${money(booking.billingSubtotal ?? booking.subtotal)}</strong></div><div><span>${booking.isVatApplicable === false ? "VAT (Non-VAT)" : `VAT (${Number(booking.vatRate || 0) * 100}%)`}</span><strong>${money(booking.vatAmount)}</strong></div><div class="total"><span>Total</span><span>${money(booking.billingTotal ?? booking.total ?? booking.paymentAmount)}</span></div>${type === "receipt" && Number(booking.cashReceived || 0) > 0 ? `<div><span>Cash received</span><strong>${money(booking.cashReceived)}</strong></div><div><span>Change</span><strong>${money(booking.changeAmount)}</strong></div>` : ""}</div>` : ""}
<div class="footer">This is a system-generated ${escapeHtml(documentType.toLowerCase())}. Verify the record in the OTLI system before use.</div>
<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`)
  popup.document.close()
}
