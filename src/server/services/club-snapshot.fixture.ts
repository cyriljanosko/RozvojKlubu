// Fictional data – never commit real names (ADR 0005).
export const sampleSnapshot = {
  fetched: "2026-10-11",
  clubs: [
    {
      app: "tj-test.futbalnet.sk",
      nazov: "TJ Test",
      zv: "ObFZ Test",
      rfz: "VsFZ",
      slug: "tj-test",
      seasons: {
        "2026/2027": {
          teams: [
            { n: "Dospelí", g: "M", a: "ADULTS", lvl: "ObFZ", comp: ["VII. liga"], pl: 22 },
            { n: "U11 - Prípravka", g: "M", a: "U11", lvl: null, comp: [], pl: 0 },
          ],
          players: [
            { a: "ADULTS", g: "M", n: 22 },
            { a: "U15", g: "F", n: 9 },
          ],
          coaches: [
            {
              n: "Ján Testovací",
              teams: ["Dospelí"],
              pos: ["coach"],
              lic: ["UEFA B"],
              exp: ["UEFA C"],
            },
          ],
          otherStaff: { manager: 2 },
          uniquePlayers: 31,
        },
      },
    },
  ],
};
