"""Generate synthetic document packages (contract, acceptance record, invoice PDF + XML) and their error labels.

Usage (from the omniops-ai folder):
    python scripts/gen_packages.py demo   -> public/samples/  (4 sample packages for the demo)
    python scripts/gen_packages.py bench  -> benchmark/       (20 packages + labels.json)

Each output folder also gets a manifest.json mapping each file's sha256 -> its ground-truth data.
Used by GEMINI_MOCK mode (local development without a Gemini key) and to score extraction quality.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))

BASE = {
    "seller": {"name": "Công ty TNHH Giải pháp Máy chủ An Phát", "tax": "0312345678"},
    "buyer": {"name": "Công ty CP Thương mại Minh Long", "tax": "0109876543"},
    "items": [
        {"code": "SV-01", "desc": "Máy chủ Dell PowerEdge", "qty": 5, "price": 200_000_000},
        {"code": "SW-01", "desc": "Bản quyền phần mềm ảo hóa", "qty": 5, "price": 30_000_000},
    ],
    "vat_rate": 10, "sign_date": "2026-09-01", "acc_date": "2026-10-05", "inv_date": "2026-10-08",
    "advance": 20, "term_days": 30, "penalty": 0.05,
}

# Error code -> the checks that must catch it (see docs/PROJECT_DOCUMENTATION.md §4)
EXPECTED = {"tax_id": ["C1"], "unit_price": ["C5", "C2"], "vat": ["C3", "C2"], "qty": ["C4", "C2"],
            "date": ["C6"], "xml": ["C7"], "penalty": ["P1"], "advance": ["P2"]}

CONTRACT_NO, ACCEPTANCE_NO, INVOICE_NO, SERIES = "01/2026/HĐMB", "NT-01/2026", "0000123", "1C26TAP"


def money(n):
    return f"{n:,}".replace(",", ".") + "đ"


def pct(x):
    return f"{x:g}".replace(".", ",")


def totals(items, vat_rate):
    sub = sum(i["qty"] * i["price"] for i in items)
    vat = round(sub * vat_rate / 100)
    return sub, vat, sub + vat


def write_pdf(path, pages):
    c = canvas.Canvas(str(path), pagesize=A4)
    for lines in pages:
        c.setFont("Arial", 11)
        y = 800
        for line in lines:
            c.drawString(50, y, line)
            y -= 18
        c.showPage()
    c.save()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(spec, errors, out_dir: Path):
    """Generate one package into out_dir. Returns a dict docType -> (file path, ground-truth data)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    k = copy.deepcopy(spec)                      # contract & acceptance: follow the base spec (except clause errors)
    inv_items = copy.deepcopy(spec["items"])     # invoice: errors may be injected here
    inv_tax, inv_date = spec["seller"]["tax"], spec["inv_date"]
    if "penalty" in errors: k["penalty"] = 0.3
    if "advance" in errors: k["advance"] = 50
    if "tax_id" in errors: inv_tax = "0312345679"
    if "unit_price" in errors: inv_items[0]["price"] = 203_000_000
    if "qty" in errors: inv_items[0]["qty"] = 6
    if "date" in errors: inv_date = "2026-10-01"
    sub_k, vat_k, tot_k = totals(k["items"], k["vat_rate"])
    sub_i, vat_i, tot_i = totals(inv_items, spec["vat_rate"])
    if "vat" in errors:
        vat_i += 10_000_000
        tot_i = sub_i + vat_i
    xml_total = tot_i + 20_000_000 if "xml" in errors else tot_i

    seller_line = f"BÊN BÁN: {k['seller']['name']} - MST: {k['seller']['tax']}"
    item_lines_k = [f"{i['code']} | {i['desc']} | SL: {i['qty']} | Đơn giá: {money(i['price'])}" for i in k["items"]]
    total_line_k = f"Tổng giá trị hợp đồng: {money(tot_k)}"
    advance_line = f"Bên mua tạm ứng {pct(k['advance'])}% giá trị hợp đồng."
    term_line = f"Phần còn lại thanh toán trong {k['term_days']} ngày kể từ ngày nghiệm thu."
    penalty_line = f"Chậm thanh toán: bên mua chịu phạt {pct(k['penalty'])}%/ngày trên số tiền chậm trả."
    write_pdf(out_dir / "contract.pdf", [
        ["HỢP ĐỒNG MUA BÁN HÀNG HÓA", f"Số: {CONTRACT_NO}", f"Ngày ký: {k['sign_date']}",
         seller_line, f"BÊN MUA: {k['buyer']['name']} - MST: {k['buyer']['tax']}"],
        ["ĐIỀU 1. HÀNG HÓA VÀ GIÁ"] + item_lines_k +
        [f"Tổng trước thuế: {money(sub_k)}", f"Thuế GTGT {k['vat_rate']}%: {money(vat_k)}", total_line_k],
        ["ĐIỀU 2. THANH TOÁN", advance_line, term_line, "ĐIỀU 3. PHẠT VI PHẠM", penalty_line],
    ])

    acc_date_line = f"Ngày nghiệm thu: {k['acc_date']}"
    item_lines_a = [f"{i['code']} | {i['desc']} | SL nghiệm thu: {i['qty']}" for i in k["items"]]
    write_pdf(out_dir / "acceptance.pdf", [[
        "BIÊN BẢN NGHIỆM THU", f"Số: {ACCEPTANCE_NO}", f"Căn cứ hợp đồng số {CONTRACT_NO}", acc_date_line] +
        item_lines_a + ["Hai bên thống nhất hàng hóa đạt yêu cầu."]])

    inv_date_line = f"Ngày lập: {inv_date}"
    inv_seller_line = f"Đơn vị bán: {k['seller']['name']} - MST: {inv_tax}"
    item_lines_i = [f"{i['code']} | {i['desc']} | SL: {i['qty']} | Đơn giá: {money(i['price'])} | "
                    f"Thành tiền: {money(i['qty'] * i['price'])}" for i in inv_items]
    vat_line = f"Thuế suất GTGT: {spec['vat_rate']}%  Tiền thuế: {money(vat_i)}"
    total_line_i = f"Tổng cộng thanh toán: {money(tot_i)}"
    write_pdf(out_dir / "invoice.pdf", [[
        "HÓA ĐƠN GIÁ TRỊ GIA TĂNG", f"Ký hiệu: {SERIES}  Số: {INVOICE_NO}", inv_date_line, inv_seller_line,
        f"Đơn vị mua: {k['buyer']['name']} - MST: {k['buyer']['tax']}"] + item_lines_i +
        [f"Cộng tiền hàng: {money(sub_i)}", vat_line, total_line_i]])

    root = Element("HDon")
    dl = SubElement(root, "DLHDon")
    tt = SubElement(dl, "TTChung")
    SubElement(tt, "KHHDon").text = SERIES
    SubElement(tt, "SHDon").text = INVOICE_NO
    SubElement(tt, "NLap").text = inv_date
    nd = SubElement(dl, "NDHDon")
    nb = SubElement(nd, "NBan")
    SubElement(nb, "Ten").text = k["seller"]["name"]
    SubElement(nb, "MST").text = inv_tax
    tto = SubElement(nd, "TToan")
    SubElement(tto, "TgTCThue").text = str(sub_i)
    SubElement(tto, "TgTThue").text = str(vat_i)
    SubElement(tto, "TgTTTBSo").text = str(xml_total)
    ElementTree(root).write(out_dir / "invoice.xml", encoding="utf-8", xml_declaration=True)

    # Ground truth in the extraction schema (docs/PROJECT_DOCUMENTATION.md §4)
    seller = {"name": k["seller"]["name"], "taxId": k["seller"]["tax"]}
    buyer = {"name": k["buyer"]["name"], "taxId": k["buyer"]["tax"]}
    risky = []
    if k["penalty"] > 0.1:
        risky.append({"page": 3, "quote": penalty_line, "reason": "Unusually high late-payment penalty for the buyer"})
    if k["advance"] > 30:
        risky.append({"page": 3, "quote": advance_line, "reason": "Large advance payment: the buyer carries the risk if the seller fails to deliver"})
    contract = {
        "contractNo": CONTRACT_NO, "signDate": k["sign_date"], "seller": seller, "buyer": buyer,
        "items": [{"code": i["code"], "description": i["desc"], "quantity": i["qty"], "unitPrice": i["price"]} for i in k["items"]],
        "subtotal": sub_k, "vatRate": k["vat_rate"], "total": tot_k,
        "advancePaymentPercent": k["advance"], "paymentTermDays": k["term_days"], "latePenaltyPercentPerDay": k["penalty"],
        "riskyClauses": risky,
        "evidence": [
            {"field": "seller.taxId", "page": 1, "quote": seller_line},
            {"field": "items", "page": 2, "quote": item_lines_k[0]},
            {"field": "total", "page": 2, "quote": total_line_k},
            {"field": "advancePaymentPercent", "page": 3, "quote": advance_line},
            {"field": "paymentTermDays", "page": 3, "quote": term_line},
            {"field": "latePenaltyPercentPerDay", "page": 3, "quote": penalty_line},
        ],
    }
    acceptance = {
        "acceptanceNo": ACCEPTANCE_NO, "contractNo": CONTRACT_NO, "acceptanceDate": k["acc_date"],
        "items": [{"code": i["code"], "description": i["desc"], "quantityAccepted": i["qty"]} for i in k["items"]],
        "evidence": [
            {"field": "acceptanceDate", "page": 1, "quote": acc_date_line},
            {"field": "items", "page": 1, "quote": item_lines_a[0]},
        ],
    }
    invoice = {
        "invoiceNo": INVOICE_NO, "series": SERIES, "issueDate": inv_date,
        "seller": {"name": k["seller"]["name"], "taxId": inv_tax}, "buyer": buyer,
        "items": [{"code": i["code"], "description": i["desc"], "quantity": i["qty"], "unitPrice": i["price"],
                   "amount": i["qty"] * i["price"]} for i in inv_items],
        "subtotal": sub_i, "vatRate": spec["vat_rate"], "vatAmount": vat_i, "total": tot_i,
        "evidence": [
            {"field": "issueDate", "page": 1, "quote": inv_date_line},
            {"field": "seller.taxId", "page": 1, "quote": inv_seller_line},
            {"field": "items", "page": 1, "quote": item_lines_i[0]},
            {"field": "vatAmount", "page": 1, "quote": vat_line},
            {"field": "total", "page": 1, "quote": total_line_i},
        ],
    }
    return {
        "contract": (out_dir / "contract.pdf", contract),
        "acceptance": (out_dir / "acceptance.pdf", acceptance),
        "invoice": (out_dir / "invoice.pdf", invoice),
    }


def generate(out: Path, plan: dict):
    manifest = {}
    for name, errs in plan.items():
        for doc_type, (path, truth) in build(BASE, errs, out / name).items():
            manifest[sha256(path)] = {"docType": doc_type, "package": name, "data": truth}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Done ->", out, f"({len(plan)} packages)")


def main(mode):
    if mode == "demo":
        generate(Path("public/samples"), {
            "s1-clean": [], "s2-errors": ["unit_price", "vat"], "s2-fixed": [], "s3-risky": ["tax_id", "date", "penalty"],
        })
    elif mode == "bench":
        singles = [[e] for e in EXPECTED]
        doubles = [["unit_price", "penalty"], ["tax_id", "date"], ["qty", "advance"], ["vat", "xml"]]
        plan = {f"pkg{n:02d}": errs for n, errs in enumerate([[]] * 8 + singles + doubles, 1)}
        out = Path("benchmark")
        generate(out, plan)
        labels = {name: sorted({c for e in errs for c in EXPECTED[e]}) for name, errs in plan.items()}
        (out / "labels.json").write_text(json.dumps(labels, indent=2), encoding="utf-8")
    else:
        sys.exit("Usage: python scripts/gen_packages.py demo|bench")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "demo")
