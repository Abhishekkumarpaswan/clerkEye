import { it } from "vitest";
import { phoneticKeys, phoneticallyEqual } from "@/lib/match/phonetic";
import { compareNames } from "@/lib/match/name";
import { tokenizeName } from "@/lib/match/text";

it("diag2", () => {
  for (const [a, b] of [["dev","deb"],["devi","debi"],["Dev","Deb"]]) {
    console.log(a, JSON.stringify(phoneticKeys(a.toLowerCase())), b, JSON.stringify(phoneticKeys(b.toLowerCase())), phoneticallyEqual(a.toLowerCase(), b.toLowerCase()));
  }
  console.log("tokens", tokenizeName("Sumit Dev Kapoor").tokens, tokenizeName("Sumit Deb Kapoor").tokens);
  const r = compareNames("Sumit Dev Kapoor", "Sumit Deb Kapoor");
  console.log(r.status, r.score, r.alignments.map(x=>`${x.token}/${x.matchedWith}:${x.score}:${x.kind}`).join(" "));
});
