// Watch the reskin's rendered schedule cards over time after injection.
// If homeAdapter's replaceChildren wipe bug fires, rows appear then collapse.
const samples = [];
for (let i = 0; i < 30; i++) {
  const rows = document.querySelectorAll(".docket-group .docket-row").length;
  const dayHeaders = document.querySelectorAll(".docket-day-header").length;
  const emptyMsg = document.querySelectorAll(".docket-empty").length;
  const overlay = document.querySelector("main .docket-page");
  samples.push({ t: i * 500, rows, dayHeaders, emptyMsg, overlayPresent: !!overlay });
  await new Promise((r) => setTimeout(r, 500));
}
return samples;
