import { isAuthenticated } from "./lib/session.js";
import { redirect } from "next/navigation";

export default async function HomePage() {
	if (await isAuthenticated()) redirect("/overview");
	redirect("/login");
}
