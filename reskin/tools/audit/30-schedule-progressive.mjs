// Runs on the Combined Schedule page right after navigation.
// Samples how the native schedule's anchor/day counts grow over time.
const samples = [];
for (let i = 0; i < 24; i++) {
  samples.push({
    t: i * 500,
    days: document.querySelectorAll(".listViewDay").length,
    anchors: document.querySelectorAll("main a.cursor-pointer.block.truncate").length,
  });
  await new Promise((r) => setTimeout(r, 500));
}
return samples;
