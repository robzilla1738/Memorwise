import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

const TEMPLATES: Record<string, { name: string; description: string; notes: { title: string; content: string }[]; suggestedPrompts: string[] }> = {
  'research-paper': {
    name: 'Research Paper',
    description: 'Analyze and understand research papers',
    notes: [
      { title: 'Paper Summary', content: '# Paper Summary\n\n## Title\n\n## Authors\n\n## Abstract\n\n## Key Findings\n\n## Methodology\n\n## Conclusions\n' },
      { title: 'Literature Review', content: '# Literature Review\n\n## Related Work\n\n## Gaps in Research\n\n## How This Paper Contributes\n' },
      { title: 'My Notes', content: '# My Notes\n\n## Key Takeaways\n\n## Questions\n\n## Ideas for Follow-up\n' },
    ],
    suggestedPrompts: ['What is the main thesis of this paper?', 'Summarize the methodology', 'What are the limitations?', 'How does this compare to related work?'],
  },
  'course-notes': {
    name: 'Course Notes',
    description: 'Organize lecture notes and study materials',
    notes: [
      { title: 'Course Overview', content: '# Course Overview\n\n## Course Name\n\n## Instructor\n\n## Objectives\n\n## Grading\n' },
      { title: 'Key Concepts', content: '# Key Concepts\n\n## Week 1\n\n## Week 2\n\n## Week 3\n' },
      { title: 'Exam Prep', content: '# Exam Preparation\n\n## Important Topics\n\n## Practice Questions\n\n## Study Schedule\n' },
    ],
    suggestedPrompts: ['Explain this concept simply', 'Create a study guide for the exam', 'What are the key terms?', 'Generate practice questions'],
  },
  'meeting-notes': {
    name: 'Meeting Notes',
    description: 'Capture and organize meeting discussions',
    notes: [
      { title: 'Meeting Summary', content: '# Meeting Summary\n\n## Date\n\n## Attendees\n\n## Agenda\n\n## Key Decisions\n\n## Action Items\n' },
      { title: 'Action Items', content: '# Action Items\n\n| Task | Owner | Due Date | Status |\n|------|-------|----------|--------|\n|      |       |          |        |\n' },
    ],
    suggestedPrompts: ['Summarize the key decisions', 'List all action items', 'What were the main discussion points?', 'Draft a follow-up email'],
  },
  'book-analysis': {
    name: 'Book Analysis',
    description: 'Deep dive into a book or text',
    notes: [
      { title: 'Book Overview', content: '# Book Overview\n\n## Title & Author\n\n## Genre\n\n## Theme\n\n## Synopsis\n' },
      { title: 'Chapter Notes', content: '# Chapter Notes\n\n## Chapter 1\n\n## Chapter 2\n\n## Chapter 3\n' },
      { title: 'Analysis', content: '# Analysis\n\n## Main Themes\n\n## Character Development\n\n## Writing Style\n\n## My Rating & Review\n' },
    ],
    suggestedPrompts: ['What are the main themes?', 'Analyze the protagonist', 'Compare this to similar works', 'What is the author\'s argument?'],
  },
  'legal-review': {
    name: 'Legal Document Review',
    description: 'Review contracts, legal documents, and policies',
    notes: [
      { title: 'Document Summary', content: '# Document Summary\n\n## Document Type\n\n## Parties Involved\n\n## Effective Date\n\n## Key Terms\n' },
      { title: 'Key Clauses', content: '# Key Clauses\n\n## Important Provisions\n\n## Obligations\n\n## Restrictions\n\n## Termination Conditions\n' },
      { title: 'Risk Assessment', content: '# Risk Assessment\n\n## Potential Issues\n\n## Missing Clauses\n\n## Recommendations\n' },
    ],
    suggestedPrompts: ['Summarize the key obligations', 'What are the termination conditions?', 'Identify potential risks', 'Explain this clause in plain English'],
  },
};

// GET: list available templates
export async function GET() {
  const templates = Object.entries(TEMPLATES).map(([id, t]) => ({
    id, name: t.name, description: t.description,
  }));
  return NextResponse.json(templates);
}

// POST: create notebook from template
export async function POST(req: Request) {
  const { templateId } = await req.json();
  const template = TEMPLATES[templateId];
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const notebook = queries.createNotebook(template.name, template.description);

  // Create template notes
  for (const note of template.notes) {
    queries.createNote(notebook.id, note.title, note.content);
  }

  return NextResponse.json({ notebook, suggestedPrompts: template.suggestedPrompts });
}
