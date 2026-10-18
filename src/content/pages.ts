import type { Locale } from "@shared/constants/locales";

/**
 * Long-form page content in both languages. Kept out of components so copy
 * can be reviewed and edited in one place. Pages marked `draft` show a notice
 * that the text is not yet approved (terms and privacy need legal review).
 */
export type ContentSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type ContentPage = {
  title: string;
  intro: string;
  draft?: boolean;
  sections: ContentSection[];
};

export const CONTENT_PAGES = [
  "about",
  "help",
  "contact",
  "terms",
  "privacy",
  "reporting",
] as const;
export type ContentPageKey = (typeof CONTENT_PAGES)[number];

export const CONTENT: Record<ContentPageKey, Record<Locale, ContentPage>> = {
  about: {
    en: {
      title: "About FarmConnect",
      intro:
        "FarmConnect Maldives is an online marketplace that helps Maldivian farmers reach buyers directly, across every atoll.",
      sections: [
        {
          heading: "Why we built it",
          paragraphs: [
            "Many farmers sell through middlemen or only to their own island. Buyers often don't know who grows what, or which farms can deliver to them.",
            "FarmConnect lists produce from farms across the country so buyers can find it, see where it comes from, and contact the farmer directly.",
          ],
        },
        {
          heading: "How it works",
          bullets: [
            "Farmers list their produce with price, quantity and delivery areas.",
            "Buyers search by product, atoll or island and contact the farmer by phone or message.",
            "Buyer and farmer agree on delivery and payment between themselves. FarmConnect does not take online payments.",
            "Farmers can record invoices and payments on the platform to keep their records in order.",
          ],
        },
        {
          heading: "Trust and safety",
          paragraphs: [
            "Farms marked as verified have been checked by our team. Anyone can report a listing or account that looks wrong, and our administrators review every report.",
          ],
        },
      ],
    },
    dv: {
      title: "ފާމްކަނެކްޓާ ބެހޭ",
      intro:
        "ފާމްކަނެކްޓް ދިވެހިރާއްޖެއަކީ ރާއްޖޭގެ ހުރިހާ އަތޮޅެއްގެ ދަނޑުވެރިން، ގަންނަ ފަރާތްތަކާ ސީދާ ގުޅުވައިދޭ އޮންލައިން ބާޒާރެކެވެ.",
      sections: [
        {
          heading: "މި ޚިދުމަތް ފެށީ ކީއްވެ",
          paragraphs: [
            "ގިނަ ދަނޑުވެރިން ބާވަތްތައް ވިއްކަނީ މެދުވެރިންގެ ތެރެއިން، ނުވަތަ އެމީހުންގެ ރަށުގައި އެކަނިއެވެ. ގަންނަ ފަރާތްތަކަށް ކޮން ބާވަތެއް ކާކު ހައްދާކަމެއް، ނުވަތަ ކޮން ދަނޑަކުން އެމީހުންނަށް ޑެލިވަރ ކުރެވޭނެކަމެއް ގިނަ ފަހަރު ނޭނގެއެވެ.",
            "ފާމްކަނެކްޓްގައި މުޅި ޤައުމުގެ ދަނޑުތަކުގެ ބާވަތްތައް ލިސްޓް ކުރެވޭއިރު، ގަންނަ ފަރާތްތަކަށް ބާވަތްތައް ހޯދައި، އެއީ ކޮންތާކުން އަންނަ ބާވަތެއްކަން ބަލައި، ދަނޑުވެރިޔާއާ ސީދާ ގުޅޭނެއެވެ.",
          ],
        },
        {
          heading: "މިއީ ކިހިނެއް",
          bullets: [
            "ދަނޑުވެރިން އަގާއި، އަދަދާއި، ޑެލިވަރ ކުރާ ސަރަހައްދުތަކާއެކު ބާވަތްތައް ލިސްޓް ކުރެއެވެ.",
            "ގަންނަ ފަރާތްތަކުން ބާވަތް، އަތޮޅު ނުވަތަ ރަށުން ހޯދައި، ފޯނުން ނުވަތަ މެސެޖުން ދަނޑުވެރިޔާއާ ގުޅެއެވެ.",
            "ޑެލިވަރީއާއި ފައިސާ ދެއްކުމުގެ އިންތިޒާމް ގަންނަ ފަރާތާއި ދަނޑުވެރިޔާ ދެމެދު ހަމަޖައްސައެވެ. ފާމްކަނެކްޓުން އޮންލައިން ފައިސާ ނުނަގައެވެ.",
            "ދަނޑުވެރިންނަށް އިންވޮއިސްތަކާއި ފައިސާ ލިބުނު މިންވަރު ޕްލެޓްފޯމްގައި ރެކޯޑް ކުރެވޭނެއެވެ.",
          ],
        },
        {
          heading: "އިތުބާރާއި ރައްކާތެރިކަން",
          paragraphs: [
            "ތަސްދީޤްކުރެވިފައިވާ ކަމަށް ފާހަގަކޮށްފައިވާ ދަނޑުތައް އަޅުގަނޑުމެންގެ ޓީމުން ޗެކް ކޮށްފައިވާ ދަނޑުތަކެވެ. ރަނގަޅު ނޫން ކަމަށް ފެންނަ ލިސްޓިންގއެއް ނުވަތަ އެކައުންޓެއް ކޮންމެ މީހަކަށްވެސް ރިޕޯޓް ކުރެވޭނެއެވެ. ކޮންމެ ރިޕޯޓެއް އެޑްމިނިސްޓްރޭޓަރުން ބަލައެވެ.",
          ],
        },
      ],
    },
  },

  help: {
    en: {
      title: "Help",
      intro:
        "Answers to common questions about buying and selling on FarmConnect.",
      sections: [
        {
          heading: "Buying",
          bullets: [
            "Use the search bar or browse by category, farm or island.",
            "Open a product to see its price, availability and where the farm delivers.",
            "Contact the farmer by phone or WhatsApp to agree quantity, delivery and payment.",
            "FarmConnect does not take payments. Never send money to anyone who contacts you claiming to be from FarmConnect.",
          ],
        },
        {
          heading: "Selling",
          bullets: [
            "Register as a farmer to create your farm profile (registration opens soon).",
            "Add each product with a clear photo, price per unit and how much you have.",
            "Choose the atolls and islands you can deliver to.",
            "Keep listings up to date — mark products sold out when they are.",
          ],
        },
        {
          heading: "Language",
          paragraphs: [
            "Switch between ދިވެހި and English at the top of any page. Your choice is remembered.",
          ],
        },
        {
          heading: "Still need help?",
          paragraphs: [
            "See the contact page, or read our guidance on reporting a problem.",
          ],
        },
      ],
    },
    dv: {
      title: "އެހީ",
      intro:
        "ފާމްކަނެކްޓްގައި ގަތުމާއި ވިއްކުމާ ބެހޭ ގިނައިން ކުރެވޭ ސުވާލުތަކުގެ ޖަވާބު.",
      sections: [
        {
          heading: "ގަތުން",
          bullets: [
            "ސާޗް ބާ ބޭނުންކުރައްވާ، ނުވަތަ ބައި، ދަނޑު ނުވަތަ ރަށުން ބައްލަވާ.",
            "ބާވަތެއް ހުޅުއްވައިގެން އޭގެ އަގާއި، ލިބެން ހުރި މިންވަރާއި، ދަނޑުން ޑެލިވަރ ކުރާ ތަންތަން ބައްލަވާ.",
            "އަދަދާއި، ޑެލިވަރީއާއި، ފައިސާ ދެއްކުމާ ބެހޭގޮތުން ހަމަޖައްސަވަން ފޯނުން ނުވަތަ ވަޓްސްއެޕުން ދަނޑުވެރިޔާއާ ގުޅުއްވާ.",
            "ފާމްކަނެކްޓުން ފައިސާ ނުނަގައެވެ. ފާމްކަނެކްޓުން ކަމަށް ބުނެ ގުޅާ އެއްވެސް މީހަކަށް ފައިސާ ނުފޮނުއްވާ.",
          ],
        },
        {
          heading: "ވިއްކުން",
          bullets: [
            "ދަނޑުގެ ޕްރޮފައިލް ހައްދަވަން ދަނޑުވެރިއެއްގެ ގޮތުގައި ރަޖިސްޓަރ ކުރައްވާ (ރަޖިސްޓްރޭޝަން އަވަހަށް ހުޅުވޭނެ).",
            "ކޮންމެ ބާވަތެއް ސާފު ފޮޓޯއަކާއި، އަގާއި، ލިބެން ހުރި އަދަދާއެކު އިތުރުކުރައްވާ.",
            "ޑެލިވަރ ކުރެވޭނެ އަތޮޅުތަކާއި ރަށްތައް އިޚްތިޔާރު ކުރައްވާ.",
            "ލިސްޓިންގތައް އަޕްޑޭޓްކޮށް ބަހައްޓަވާ — ވިކިގެން ހުސްވާ ބާވަތްތައް ވިކިގެން ހުސްވެއްޖެ ކަމަށް ފާހަގަ ކުރައްވާ.",
          ],
        },
        {
          heading: "ބަސް",
          paragraphs: [
            "ކޮންމެ ޞަފްޙާއެއްގެ މަތީގައި ދިވެހި އާއި English އާ ދެމެދު ބަދަލު ކުރެވޭނެއެވެ. ތިޔަބޭފުޅާ އިޚްތިޔާރު ކުރައްވާ ބަސް ހަނދާން ބަހައްޓާނެއެވެ.",
          ],
        },
        {
          heading: "އިތުރު އެހީއެއް ބޭނުންފުޅުތަ؟",
          paragraphs: [
            "ގުޅުއްވާނެ ޞަފްޙާ ބައްލަވާ، ނުވަތަ މައްސަލައެއް ރިޕޯޓް ކުރާނެ ގޮތުގެ އިރުޝާދު ކިޔުއްވާ.",
          ],
        },
      ],
    },
  },

  contact: {
    en: {
      title: "Contact us",
      intro: "How to get in touch with the FarmConnect team.",
      sections: [
        {
          heading: "Contact details",
          paragraphs: [
            "Our official email address and phone number will be published here before the marketplace launches. Until then, please don't trust anyone claiming to represent FarmConnect.",
          ],
        },
        {
          heading: "Questions about an order",
          paragraphs: [
            "Orders, delivery and payment are arranged directly between buyer and farmer. Please contact the farmer using the details on their listing.",
          ],
        },
        {
          heading: "Reporting a problem",
          paragraphs: [
            "If a listing or account looks fraudulent or unsafe, read our reporting guidance.",
          ],
        },
      ],
    },
    dv: {
      title: "އަޅުގަނޑުމެންނާ ގުޅުއްވާ",
      intro: "ފާމްކަނެކްޓް ޓީމާ ގުޅުއްވާނެ ގޮތް.",
      sections: [
        {
          heading: "ގުޅޭނެ މަޢުލޫމާތު",
          paragraphs: [
            "އަޅުގަނޑުމެންގެ ރަސްމީ އީމެއިލް އެޑްރެހާއި ފޯނު ނަންބަރު ބާޒާރު ލޯންޗް ކުރުމުގެ ކުރިން މިތާ ޝާއިޢު ކުރެވޭނެއެވެ. އެހާތަނަށް، ފާމްކަނެކްޓް ތަމްސީލު ކުރާ ކަމަށް ބުނާ އެއްވެސް މީހަކަށް އިތުބާރު ނުކުރައްވާ.",
          ],
        },
        {
          heading: "އޯޑަރަކާ ބެހޭ ސުވާލު",
          paragraphs: [
            "އޯޑަރު، ޑެލިވަރީ އަދި ފައިސާ ދެއްކުމުގެ އިންތިޒާމް ހަމަޖައްސަނީ ގަންނަ ފަރާތާއި ދަނޑުވެރިޔާ ސީދާ ގުޅިގެންނެވެ. ލިސްޓިންގގައިވާ މަޢުލޫމާތު ބޭނުންކޮށްގެން ދަނޑުވެރިޔާއާ ގުޅުއްވާ.",
          ],
        },
        {
          heading: "މައްސަލައެއް ރިޕޯޓް ކުރުން",
          paragraphs: [
            "ލިސްޓިންގއެއް ނުވަތަ އެކައުންޓެއް ޚިޔާނާތްތެރި ނުވަތަ ނުރައްކާތެރި ކަމަށް ފެންނަނަމަ، ރިޕޯޓް ކުރުމުގެ އިރުޝާދު ކިޔުއްވާ.",
          ],
        },
      ],
    },
  },

  terms: {
    en: {
      title: "Terms of use",
      intro: "The rules for using FarmConnect Maldives.",
      draft: true,
      sections: [
        {
          heading: "1. What FarmConnect is",
          paragraphs: [
            "FarmConnect is a listing service that connects farmers and buyers. FarmConnect is not a party to any sale, does not handle payments and does not deliver goods.",
          ],
        },
        {
          heading: "2. Accounts",
          bullets: [
            "You must give accurate information when you register and keep it up to date.",
            "You are responsible for activity on your account. Keep your password private.",
            "We may suspend or block accounts that break these terms or put other users at risk.",
          ],
        },
        {
          heading: "3. Listings",
          bullets: [
            "Farmers may only list produce they grow or are entitled to sell.",
            "Prices, quantities, photos and descriptions must be accurate and kept up to date.",
            "Illegal, unsafe or prohibited items must not be listed.",
            "We may remove listings that break these rules.",
          ],
        },
        {
          heading: "4. Sales between users",
          paragraphs: [
            "Buyers and farmers agree price, delivery and payment between themselves and are responsible for meeting those agreements. Invoices and payment records on FarmConnect are records kept by users, not proof of payment by FarmConnect.",
          ],
        },
        {
          heading: "5. Reporting and enforcement",
          paragraphs: [
            "Users can report suspected fraud or abuse. Administrators review reports and may remove content or block accounts.",
          ],
        },
        {
          heading: "6. Changes",
          paragraphs: [
            "We may update these terms. We will show the date of the latest version on this page.",
          ],
        },
      ],
    },
    dv: {
      title: "ބޭނުންކުރުމުގެ ޝަރުތުތައް",
      intro: "ފާމްކަނެކްޓް ދިވެހިރާއްޖެ ބޭނުންކުރުމުގެ ޤަވާޢިދު.",
      draft: true,
      sections: [
        {
          heading: "1. ފާމްކަނެކްޓަކީ ކޮބާ",
          paragraphs: [
            "ފާމްކަނެކްޓަކީ ދަނޑުވެރިންނާއި ގަންނަ ފަރާތްތައް ގުޅުވައިދޭ ލިސްޓިންގ ޚިދުމަތެކެވެ. ފާމްކަނެކްޓަކީ އެއްވެސް ވިއްކުމެއްގެ ފަރާތެއް ނޫނެވެ. ފައިސާ ނުނަގައި، މުދާ ޑެލިވަރެއް ނުކުރެއެވެ.",
          ],
        },
        {
          heading: "2. އެކައުންޓް",
          bullets: [
            "ރަޖިސްޓަރ ކުރާއިރު ދޭންވާނީ ތެދު މަޢުލޫމާތު، އަދި އެ މަޢުލޫމާތު އަޕްޑޭޓްކޮށް ބަހައްޓަންވާނެ.",
            "ތިޔަބޭފުޅާގެ އެކައުންޓުން ކުރެވޭ ކަންކަމުގެ ޒިންމާ ތިޔަބޭފުޅާއަށް. ޕާސްވޯޑް ސިއްރުކޮށް ބަހައްޓަވާ.",
            "މި ޝަރުތުތައް ފުށުއަރާ ނުވަތަ އެހެން ފަރާތްތައް ނުރައްކަލަށް ލާ އެކައުންޓްތައް ހުއްޓާލުމުގެ ނުވަތަ ބްލޮކް ކުރުމުގެ ޙައްޤު އަޅުގަނޑުމެންނަށް ލިބިގެންވެއެވެ.",
          ],
        },
        {
          heading: "3. ލިސްޓިންގ",
          bullets: [
            "ދަނޑުވެރިންނަށް ލިސްޓް ކުރެވޭނީ އެމީހުން ހައްދާ، ނުވަތަ ވިއްކުމުގެ ޙައްޤު ލިބިފައިވާ ބާވަތްތައް އެކަނި.",
            "އަގާއި، އަދަދާއި، ފޮޓޯއާއި، ތަފްޞީލު ތެދުވާންވާނެ، އަދި އަޕްޑޭޓްކޮށް ބަހައްޓަންވާނެ.",
            "ޤާނޫނާ ޚިލާފު، ނުރައްކާތެރި ނުވަތަ މަނާ ބާވަތްތައް ލިސްޓް ނުކުރެވޭނެ.",
            "މި ޤަވާޢިދު ފުށުއަރާ ލިސްޓިންގތައް ނައްތާލުމުގެ ޙައްޤު އަޅުގަނޑުމެންނަށް ލިބިގެންވެއެވެ.",
          ],
        },
        {
          heading: "4. ބޭނުންކުރާ ފަރާތްތަކުގެ ދެމެދު ވިއްކުން",
          paragraphs: [
            "އަގާއި، ޑެލިވަރީއާއި، ފައިސާ ދެއްކުން ހަމަޖައްސަނީ ގަންނަ ފަރާތާއި ދަނޑުވެރިޔާ ދެމެދުގައެވެ. އެ އެއްބަސްވުންތައް ފުއްދުމުގެ ޒިންމާ އެ ފަރާތްތަކަށެވެ. ފާމްކަނެކްޓްގައިވާ އިންވޮއިސްތަކާއި ފައިސާގެ ރެކޯޑްތަކަކީ ބޭނުންކުރާ ފަރާތްތަކުން ބަހައްޓާ ރެކޯޑްތަކެއް، ފާމްކަނެކްޓުން ފައިސާ ދެއްކިކަމުގެ ހެކިތަކެއް ނޫނެވެ.",
          ],
        },
        {
          heading: "5. ރިޕޯޓް ކުރުމާއި ފިޔަވަޅު އެޅުން",
          paragraphs: [
            "ޚިޔާނާތް ނުވަތަ އަނިޔާވެރިކަމުގެ ޝައްކު ހުރި ކަންކަން ބޭނުންކުރާ ފަރާތްތަކަށް ރިޕޯޓް ކުރެވޭނެއެވެ. އެޑްމިނިސްޓްރޭޓަރުން ރިޕޯޓްތައް ބަލައި، ކޮންޓެންޓް ނައްތާލުމާއި އެކައުންޓް ބްލޮކް ކުރުން ފަދަ ފިޔަވަޅު އަޅައިފާނެއެވެ.",
          ],
        },
        {
          heading: "6. ބަދަލުތައް",
          paragraphs: [
            "މި ޝަރުތުތަކަށް އަޅުގަނޑުމެން ބަދަލު ގެނެސްފާނެއެވެ. އެންމެ ފަހުގެ ވަރޝަންގެ ތާރީޚު މި ޞަފްޙާގައި ދައްކާނެއެވެ.",
          ],
        },
      ],
    },
  },

  privacy: {
    en: {
      title: "Privacy",
      intro: "What information FarmConnect collects and how it is used.",
      draft: true,
      sections: [
        {
          heading: "Information we collect",
          bullets: [
            "Account details: your name, email address, phone number, preferred language and island.",
            "Farm profiles: farm name, description, location, contact numbers and delivery areas.",
            "Listings, photos, enquiries, invoices and payment records you create.",
            "Reports you submit about listings or accounts.",
          ],
        },
        {
          heading: "What is public",
          paragraphs: [
            "Farm profiles, listings and the contact numbers farmers choose to add are shown publicly so buyers can contact farmers directly. Buyer account details are not public.",
          ],
        },
        {
          heading: "How we use it",
          bullets: [
            "To run the marketplace and show listings to buyers.",
            "To keep the platform safe, including reviewing reports and blocking accounts.",
            "To produce overall usage statistics (daily totals such as page views, product views and contact clicks). These do not identify individuals.",
          ],
        },
        {
          heading: "Usage statistics",
          paragraphs: [
            "To count visits without identifying you, your browser keeps a random number in its local storage (not a cookie, and not linked to your account). Pages you open are added to daily totals; we don't keep a record of individual visits, your search words or your network address. Clearing your browser's site data removes the number.",
          ],
        },
        {
          heading: "Where it is stored",
          paragraphs: [
            "Data is stored with Google Firebase. Access is limited to the account owner and authorised administrators.",
          ],
        },
        {
          heading: "Your choices",
          paragraphs: [
            "You can update your profile at any time. To delete your account, use the contact details on our contact page once they are published.",
          ],
        },
      ],
    },
    dv: {
      title: "ޕްރައިވެސީ",
      intro: "ފާމްކަނެކްޓުން ނަގާ މަޢުލޫމާތާއި، އެ މަޢުލޫމާތު ބޭނުންކުރާ ގޮތް.",
      draft: true,
      sections: [
        {
          heading: "އަޅުގަނޑުމެން ނަގާ މަޢުލޫމާތު",
          bullets: [
            "އެކައުންޓުގެ މަޢުލޫމާތު: ނަން، އީމެއިލް އެޑްރެސް، ފޯނު ނަންބަރު، ބޭނުންކުރާ ބަސް އަދި ރަށް.",
            "ދަނޑުގެ ޕްރޮފައިލް: ދަނޑުގެ ނަން، ތަފްޞީލު، ހުރި ތަން، ގުޅޭނެ ނަންބަރުތަކާއި ޑެލިވަރ ކުރާ ސަރަހައްދުތައް.",
            "ތިޔަބޭފުޅާ ހައްދަވާ ލިސްޓިންގ، ފޮޓޯ، އެންކުއަޔަރީ، އިންވޮއިސް އަދި ފައިސާގެ ރެކޯޑް.",
            "ލިސްޓިންގ ނުވަތަ އެކައުންޓްތަކާ ބެހޭގޮތުން ތިޔަބޭފުޅާ ފޮނުއްވާ ރިޕޯޓްތައް.",
          ],
        },
        {
          heading: "ފާޅުކޮށް ފެންނަ މަޢުލޫމާތު",
          paragraphs: [
            "ގަންނަ ފަރާތްތަކަށް ދަނޑުވެރިންނާ ސީދާ ގުޅޭތޯ، ދަނޑުގެ ޕްރޮފައިލްތަކާއި ލިސްޓިންގތަކާއި ދަނޑުވެރިން އިތުރުކުރާ ގުޅޭނެ ނަންބަރުތައް ފާޅުކޮށް ދައްކައެވެ. ގަންނަ ފަރާތްތަކުގެ އެކައުންޓުގެ މަޢުލޫމާތު ފާޅުކޮށް ނުދައްކައެވެ.",
          ],
        },
        {
          heading: "މަޢުލޫމާތު ބޭނުންކުރާ ގޮތް",
          bullets: [
            "ބާޒާރު ހިންގައި، ގަންނަ ފަރާތްތަކަށް ލިސްޓިންގތައް ދެއްކުމަށް.",
            "ރިޕޯޓްތައް ބެލުމާއި އެކައުންޓްތައް ބްލޮކް ކުރުން ހިމެނޭގޮތަށް، ޕްލެޓްފޯމް ރައްކާތެރިކޮށް ބެހެއްޓުމަށް.",
            "ޖުމްލަ ބޭނުންކުރުމުގެ ތަފާސް ހިސާބު (ޞަފްޙާ ބެލުން، ޕްރޮޑަކްޓް ބެލުން އަދި ގުޅުމަށް ފިތާލުން ފަދަ ދުވާލަކު ޖުމްލަ އަދަދު) ތައްޔާރު ކުރުމަށް. މިއިން ވަކި ފަރާތެއް ދެނެގަނެވޭކަށް ނެތެވެ.",
          ],
        },
        {
          heading: "ބޭނުންކުރުމުގެ ތަފާސް ހިސާބު",
          paragraphs: [
            "ތިޔަބޭފުޅާ ދެނެނުގަނެ ޒިޔާރަތްތައް ގުނުމަށް، ތިޔަބޭފުޅާގެ ބްރައުޒަރުގެ ލޯކަލް ސްޓޯރޭޖުގައި ރެންޑަމް ނަންބަރެއް ރައްކާކުރެއެވެ (މިއީ ކުކީއެއް ނޫން، އަދި އެކައުންޓާ ގުޅިފައެއް ނުވެއެވެ). ހުޅުވާ ޞަފްޙާތައް ހިމެނެނީ ދުވާލަކު ޖުމްލަ އަދަދުތަކުގައެވެ. ވަކި ޒިޔާރަތްތަކުގެ ރެކޯޑެއް، ހޯދި ބަސްތަކެއް ނުވަތަ ނެޓްވޯކް އެޑްރެސެއް ރައްކާ ނުކުރެއެވެ. ބްރައުޒަރުގެ ސައިޓް ޑޭޓާ ފޮހެލުމުން އެ ނަންބަރު ފޮހެވެއެވެ.",
          ],
        },
        {
          heading: "މަޢުލޫމާތު ރައްކާކުރާ ތަން",
          paragraphs: [
            "މަޢުލޫމާތު ރައްކާކުރަނީ ގޫގުލް ފަޔަރބޭސްގައެވެ. މަޢުލޫމާތަށް ވަދެވެނީ އެކައުންޓުގެ ވެރިފަރާތާއި ހުއްދަ ލިބިފައިވާ އެޑްމިނިސްޓްރޭޓަރުންނަށް އެކަނިއެވެ.",
          ],
        },
        {
          heading: "ތިޔަބޭފުޅާގެ އިޚްތިޔާރު",
          paragraphs: [
            "ޕްރޮފައިލް ކޮންމެ ވަގުތެއްގައިވެސް އަޕްޑޭޓް ކުރެވޭނެއެވެ. އެކައުންޓް ފުހެލަން ބޭނުންފުޅުނަމަ، ގުޅުއްވާނެ ޞަފްޙާގައި މަޢުލޫމާތު ޝާއިޢު ކުރުމުން އެ މަޢުލޫމާތު ބޭނުންކޮށްގެން ގުޅުއްވާ.",
          ],
        },
      ],
    },
  },

  reporting: {
    en: {
      title: "Reporting & safety",
      intro:
        "How to stay safe when buying and selling, and how to report a problem.",
      sections: [
        {
          heading: "Stay safe",
          bullets: [
            "Agree price, quantity and delivery clearly before paying.",
            "For first orders, consider paying on delivery or paying part up front.",
            "Be careful with prices that seem far too low, or sellers who pressure you to pay quickly.",
            "FarmConnect will never ask you for your password or for payment.",
          ],
        },
        {
          heading: "What to report",
          bullets: [
            "Fake listings or farms that don't exist.",
            "Payment taken but goods never delivered.",
            "Wrong prices or quantities used to mislead buyers.",
            "Abusive or threatening behaviour.",
            "Prohibited or unsafe items.",
          ],
        },
        {
          heading: "How to report",
          paragraphs: [
            "Once accounts open, every listing and farm profile will have a “Report” button. Signed-in users will be able to choose a reason and add details. Until then, reports can't be submitted on the site.",
          ],
        },
        {
          heading: "What happens next",
          paragraphs: [
            "Administrators review every report. Depending on what we find, we may contact the people involved, remove listings, or block accounts. The person who reported can see the status of their report.",
          ],
        },
        {
          heading: "In an emergency",
          paragraphs: [
            "If you are in danger or a crime has been committed, contact the Maldives Police Service.",
          ],
        },
      ],
    },
    dv: {
      title: "ރިޕޯޓް ކުރުމާއި ރައްކާތެރިކަން",
      intro:
        "ގަތުމާއި ވިއްކުމުގައި ރައްކާތެރިވާނެ ގޮތާއި، މައްސަލައެއް ރިޕޯޓް ކުރާނެ ގޮތް.",
      sections: [
        {
          heading: "ރައްކާތެރިވެވަޑައިގަންނަވާ",
          bullets: [
            "ފައިސާ ދެއްކެވުމުގެ ކުރިން އަގާއި، އަދަދާއި، ޑެލިވަރީ ސާފުކޮށް ހަމަޖައްސަވާ.",
            "ފުރަތަމަ އޯޑަރުތަކުގައި، ޑެލިވަރީ ލިބުމުން ފައިސާ ދެއްކެވުން، ނުވަތަ ބައެއް ކުރިން ދެއްކެވުމަށް ވިސްނުންފުޅު ހިންގަވާ.",
            "ވަރަށް ބޮޑަށް ދަށް އަގުތަކާއި، އަވަހަށް ފައިސާ ދައްކަން މަޖުބޫރު ކުރާ ވިއްކާ ފަރާތްތަކާމެދު ސަމާލުވެވަޑައިގަންނަވާ.",
            "ފާމްކަނެކްޓުން ދުވަހަކުވެސް ތިޔަބޭފުޅާގެ ޕާސްވޯޑެއް ނުވަތަ ފައިސާއެއް ނުއެދޭނެއެވެ.",
          ],
        },
        {
          heading: "ރިޕޯޓް ކުރަންވީ ކަންކަން",
          bullets: [
            "ދޮގު ލިސްޓިންގ ނުވަތަ ނެތް ދަނޑުތައް.",
            "ފައިސާ ނަގައިގެން މުދާ ޑެލިވަރ ނުކުރުން.",
            "ގަންނަ ފަރާތްތައް އޮޅުވާލުމަށް ގޯސް އަގު ނުވަތަ އަދަދު ބޭނުންކުރުން.",
            "އަނިޔާވެރި ނުވަތަ އިންޒާރުދޭ ސުލޫކު.",
            "މަނާ ނުވަތަ ނުރައްކާތެރި ބާވަތްތައް.",
          ],
        },
        {
          heading: "ރިޕޯޓް ކުރާނެ ގޮތް",
          paragraphs: [
            'އެކައުންޓް ހުޅުވުމުން، ކޮންމެ ލިސްޓިންގއަކާއި ދަނޑުގެ ޕްރޮފައިލެއްގައި "ރިޕޯޓް" ބަޓަނެއް ހުންނާނެއެވެ. ލޮގިން ވެފައިވާ ފަރާތްތަކަށް ސަބަބެއް އިޚްތިޔާރުކޮށް ތަފްޞީލު އިތުރުކުރެވޭނެއެވެ. އެހާތަނަށް ސައިޓުން ރިޕޯޓެއް ނުފޮނުވޭނެއެވެ.',
          ],
        },
        {
          heading: "ދެން ކުރެވޭނެ ކަންތައް",
          paragraphs: [
            "ކޮންމެ ރިޕޯޓެއް އެޑްމިނިސްޓްރޭޓަރުން ބަލައެވެ. ފެންނަ ކަންތައްތަކާ ގުޅިގެން، ބެހޭ ފަރާތްތަކާ ގުޅުން، ލިސްޓިންގ ނައްތާލުން، ނުވަތަ އެކައުންޓް ބްލޮކް ކުރުން ފަދަ ފިޔަވަޅު އަޅައިފާނެއެވެ. ރިޕޯޓް ކުރި ފަރާތަށް ރިޕޯޓުގެ ހާލަތު ބެލޭނެއެވެ.",
          ],
        },
        {
          heading: "ކުއްލި ހާލަތެއްގައި",
          paragraphs: [
            "ނުރައްކަލެއްގައި ވާނަމަ، ނުވަތަ ކުށެއް ކުރެވިއްޖެނަމަ، ދިވެހި ފުލުހުންނާ ގުޅުއްވާ.",
          ],
        },
      ],
    },
  },
};
