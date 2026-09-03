import { revalidatePath } from "next/cache";

export function revalidateSite() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}
