import type { Metadata } from "next";
import Quiz from "@/components/Quiz";

export const metadata: Metadata = {
  title: "Find your shade",
  description: "A few questions. One shade that suits your skin and your tone.",
  alternates: { canonical: "/quiz" },
};

export default function QuizPage() {
  return <Quiz />;
}
