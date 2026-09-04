// Is "General" currently expanded? What does its header look like in this state?
const sheet = document.querySelector(".popupWrapper .minMax");
if (!sheet) return { error: "no sheet open" };
const radios = Array.from(sheet.querySelectorAll("input[type='radio']")).map((r) => ({ v: r.value, checked: r.checked }));
const rows = Array.from(sheet.querySelectorAll("div"))
  .filter((el) => {
    const t = (el.textContent ?? "").trim();
    return t.length > 0 && t.length < 60 && el.className && /bg-|cursor-pointer/.test(el.className.toString());
  })
  .slice(0, 12)
  .map((el) => ({ cls: el.className.toString().slice(0, 90), txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30) }));
return { radioCount: radios.length, radios, rows };
