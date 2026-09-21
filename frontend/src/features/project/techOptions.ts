import type { TechCategory } from "@/types";

export interface TechGroup {
  category: TechCategory;
  label: string;
  description: string;
  options: readonly string[];
}

export const TECH_GROUPS: readonly TechGroup[] = [
  {
    category: "LANGUAGE",
    label: "개발 언어",
    description: "프로젝트에서 사용하는 언어를 모두 선택하세요.",
    options: [
      "Java", "Python", "JavaScript", "TypeScript", "C#", "C++",
      "Go", "PHP", "Ruby", "Kotlin", "Swift", "Rust",
    ],
  },
  {
    category: "FRAMEWORK",
    label: "Framework",
    description: "백엔드·프런트엔드 프레임워크를 선택하세요.",
    options: [
      "Spring Boot", "React", "Next.js", "Vue", "Angular",
      "FastAPI", "Django", "Flask", "Node.js", "Express", "NestJS", ".NET",
    ],
  },
  {
    category: "DATABASE",
    label: "Database",
    description: "데이터 저장소를 선택하세요.",
    options: ["MySQL", "PostgreSQL", "Oracle", "MSSQL", "MongoDB", "Redis", "MariaDB", "SQLite"],
  },
  {
    category: "INFRASTRUCTURE",
    label: "Infrastructure",
    description: "배포·운영 환경을 선택하세요.",
    options: ["AWS", "Azure", "GCP", "On-Premise", "Docker", "Kubernetes", "Nginx", "Apache"],
  },
] as const;

export const CATEGORY_LABEL: Record<TechCategory, string> = {
  LANGUAGE: "언어",
  FRAMEWORK: "Framework",
  DATABASE: "Database",
  INFRASTRUCTURE: "Infrastructure",
};
