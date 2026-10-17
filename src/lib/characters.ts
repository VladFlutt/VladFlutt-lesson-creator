// Recurring lesson characters. Images in /public/characters are the style and
// likeness references sent to the image model.

export type Character = { id: string; appearance: string; refs: string[] };

export const CHARACTERS: Character[] = [
  { id: "alex", appearance: "young man with short brown hair and black rectangular glasses, sage-green hoodie, backpack strap", refs: ["friends-alex-nikos.jpg"] },
  { id: "nikos", appearance: "cheerful young man with messy brown hair and one curl sticking up, lavender t-shirt, backpack", refs: ["friends-alex-nikos.jpg"] },
  { id: "yannis", appearance: "man with a long full brown beard, red baseball cap, blue denim shirt", refs: ["yannis.jpg"] },
  { id: "maria", appearance: "woman with shoulder-length straight brown hair, small pearl earrings, lilac striped shirt", refs: ["maria.jpg", "couple-maria-kostas.jpg"] },
  { id: "kostas", appearance: "bald man with a thick dark moustache and short grey stubble, mustard polo shirt, wristwatch", refs: ["couple-maria-kostas.jpg"] },
  { id: "dimitris", appearance: "man with swept brown hair and a full trimmed beard, light blue short-sleeved shirt", refs: ["dimitris.jpg"] },
  { id: "elena", appearance: "smiling woman with short ginger hair, dangling earrings, black-and-white floral top", refs: ["elena.jpg", "couple-elena-petros.jpg"] },
  { id: "petros", appearance: "young man with shaggy brown hair, mustard t-shirt and navy jacket with red trim", refs: ["petros.jpg", "couple-elena-petros.jpg"] },
  { id: "georgios", appearance: "bald man with thin metal glasses, curled brown moustache and stubble, black jacket, red lanyard", refs: ["georgios.jpg"] },
  { id: "sofia", appearance: "young woman with long wavy brown hair, small white flower clip, black headphones around her neck, striped top", refs: ["sofia.jpg"] },
];

export const STYLE =
  "Handmade papercraft diorama: characters and scenery cut from textured kraft paper and cardboard, layered paper hair, " +
  "simple dot eyes, round pink paper cheeks, triangular paper noses, soft natural light, shallow depth of field. " +
  "Match the style and the characters' likeness from the reference images exactly. No text or letters in the image.";
