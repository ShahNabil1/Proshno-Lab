import { ENGLISH_PAPER_FONTS } from "./englishPaperFonts";

const BENGALI_PAPER_FONTS = [
  {
    "id": "anek-bangla",
    "label": "Anek Bangla",
    "family": "Anek Bangla"
  },
  {
    "id": "anupam-mahdi-s-a-u",
    "label": "Anupam Mahdi S_A_U",
    "family": "Anupam Mahdi S_A_U"
  },
  {
    "id": "asavari",
    "label": "Asavari",
    "family": "Asavari"
  },
  {
    "id": "bensen",
    "label": "BenSen",
    "family": "BenSen"
  },
  {
    "id": "bidisha-unicode",
    "label": "Bidisha Unicode",
    "family": "Bidisha Unicode"
  },
  {
    "id": "bishnu-unicode",
    "label": "Bishnu Unicode",
    "family": "Bishnu Unicode"
  },
  {
    "id": "borno-porichay",
    "label": "Borno porichay",
    "family": "Borno porichay"
  },
  {
    "id": "hind-siliguri",
    "label": "Hind Siliguri",
    "family": "Hind Siliguri"
  },
  {
    "id": "lb-anupama-unicode",
    "label": "LB Anupama Unicode",
    "family": "LB Anupama Unicode"
  },
  {
    "id": "li-ador-noirrit",
    "label": "Li Ador Noirrit",
    "family": "Li Ador Noirrit"
  },
  {
    "id": "li-al-quds-unicode",
    "label": "Li Al Quds Unicode",
    "family": "Li Al Quds Unicode"
  },
  {
    "id": "li-alinur-atithi-unicode",
    "label": "Li Alinur Atithi Unicode",
    "family": "Li Alinur Atithi Unicode"
  },
  {
    "id": "li-alinur-projapoti-unicode",
    "label": "Li Alinur Projapoti Unicode",
    "family": "Li Alinur Projapoti Unicode"
  },
  {
    "id": "li-alinur-rupnagar-unicode",
    "label": "Li Alinur Rupnagar Unicode",
    "family": "Li Alinur Rupnagar Unicode"
  },
  {
    "id": "li-alinur-saikat-unicode",
    "label": "Li Alinur Saikat Unicode",
    "family": "Li Alinur Saikat Unicode"
  },
  {
    "id": "li-alinur-sanghoti-unicode",
    "label": "Li Alinur Sanghoti Unicode",
    "family": "Li Alinur Sanghoti Unicode"
  },
  {
    "id": "li-alinur-shishir-unicode",
    "label": "Li Alinur Shishir Unicode",
    "family": "Li Alinur Shishir Unicode"
  },
  {
    "id": "li-azad-pori-unicode",
    "label": "Li Azad Pori Unicode",
    "family": "Li Azad Pori Unicode"
  },
  {
    "id": "li-bijoy-swapnochura-unicode",
    "label": "Li Bijoy Swapnochura Unicode",
    "family": "Li Bijoy Swapnochura Unicode"
  },
  {
    "id": "li-hasan-hera-unicode",
    "label": "Li Hasan Hera Unicode",
    "family": "Li Hasan Hera Unicode"
  },
  {
    "id": "li-hasan-meghaloy-matra-unicode",
    "label": "Li Hasan Meghaloy Matra Unicode",
    "family": "Li Hasan Meghaloy Matra Unicode"
  },
  {
    "id": "li-hasan-meghaloy-unicode",
    "label": "Li Hasan Meghaloy Unicode",
    "family": "Li Hasan Meghaloy Unicode"
  },
  {
    "id": "li-hasan-protivas-unicode",
    "label": "Li Hasan Protivas Unicode",
    "family": "Li Hasan Protivas Unicode"
  },
  {
    "id": "li-kaium-simanto-unicode",
    "label": "Li Kaium Simanto Unicode",
    "family": "Li Kaium Simanto Unicode"
  },
  {
    "id": "li-mak-sylhet-unicode",
    "label": "Li MAK Sylhet Unicode",
    "family": "Li MAK Sylhet Unicode"
  },
  {
    "id": "li-niladri-moitree-unicode",
    "label": "Li Niladri Moitree Unicode",
    "family": "Li Niladri Moitree Unicode"
  },
  {
    "id": "li-niladri-nodia-unicode",
    "label": "Li Niladri Nodia Unicode",
    "family": "Li Niladri Nodia Unicode"
  },
  {
    "id": "li-purno-pran-unicode",
    "label": "Li Purno Pran Unicode",
    "family": "Li Purno Pran Unicode"
  },
  {
    "id": "li-saboj-toru-unicode",
    "label": "Li Saboj Toru Unicode",
    "family": "Li Saboj Toru Unicode"
  },
  {
    "id": "nill-jannati-matra",
    "label": "Nill Jannati Matra",
    "family": "Nill Jannati Matra"
  },
  {
    "id": "nill-jannati-matrahin",
    "label": "Nill Jannati Matrahin",
    "family": "Nill Jannati Matrahin"
  },
  {
    "id": "noore-madina-unicode",
    "label": "Noore Madina Unicode",
    "family": "Noore Madina Unicode"
  },
  {
    "id": "shokuntola-unicode",
    "label": "Shokuntola UNICODE",
    "family": "Shokuntola UNICODE"
  },
  {
    "id": "toha-borno-matrahin-unicode",
    "label": "Toha Borno Matrahin Unicode",
    "family": "Toha Borno Matrahin Unicode"
  }
] as const;

export const UNICODE_PAPER_FONTS = [...BENGALI_PAPER_FONTS, ...ENGLISH_PAPER_FONTS] as const;

export function paperFontFamily(id: string): string {
 const font = UNICODE_PAPER_FONTS.find(f => f.id === id);
 if (font && ENGLISH_PAPER_FONTS.some(f => f.id === id)) return `"${font.family}", "Times New Roman", "SolaimanLipi", serif`;
 if (font) return `"Times New Roman", "${font.family}", "SolaimanLipi", serif`;
 if (id === "timesnewroman") return "\"Times New Roman\", Georgia, serif";
 if (id === "kalpurush") return "\"Times New Roman\", Kalpurush, serif";
 if (id === "omicronbangla") return "\"Times New Roman\", OmicronBangla, SolaimanLipi, serif";
 return "\"Times New Roman\", SolaimanLipi, serif";
}

export function paperWordFont(id: string): string {
 return UNICODE_PAPER_FONTS.find(f => f.id === id)?.family || (id === "kalpurush" ? "Kalpurush" : id === "timesnewroman" ? "Times New Roman" : "SolaimanLipi");
}
