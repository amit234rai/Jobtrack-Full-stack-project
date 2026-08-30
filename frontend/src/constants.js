export const stages = ["saved", "applied", "oa", "interview", "offer", "rejected"];

export function label(value) {
  if (value === "oa") return "Online assessment";
  return value[0].toUpperCase() + value.slice(1);
}
