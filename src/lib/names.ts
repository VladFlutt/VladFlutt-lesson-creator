import { instrumentName, type Instrument } from "./catalog";

export function instrumentNames(instruments: Instrument[], ui: string) {
  return Object.fromEntries(instruments.map((i) => [i.key, instrumentName(i, ui)]));
}
