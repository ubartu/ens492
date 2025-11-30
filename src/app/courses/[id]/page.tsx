import { getDb, Course } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AddToCalendarBtn from '@/components/AddToCalendarBtn';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, MapPin, User, CheckCircle2, XCircle, BookOpen, Target, Sparkles, GraduationCap, Zap, Calendar, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import CourseReviews from "@/components/CourseReviews";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

interface Props {
    params: Promise<{ id: string }>;
}

interface SyllabusData {
    instructors?: { name: string; email?: string }[];
    course_objective?: string | string[];
    course_learning_outcomes?: string[];
    assessment_percent?: Record<string, number>;
}

function parseSyllabus(syllabusText: string): SyllabusData | null {
    try { return JSON.parse(syllabusText); } catch { return null; }
}

function extractLearningOutcomes(outcomes: string[] | undefined): string[] {
    if (!outcomes || outcomes.length === 0) return [];
    const result: string[] = [];
    for (const outcome of outcomes) {
        const parts = outcome.split(/\d+\.\s+/).filter(Boolean);
        for (const part of parts) {
            const cleaned = part.trim().replace(/^[\d.]+\s*/, '');
            if (cleaned.length > 10 && cleaned.length < 200) result.push(cleaned);
        }
    }
    return result.slice(0, 5);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);
    const db = await getDb();
    const { results } = await db.prepare('SELECT * FROM courses WHERE id = ?').bind(id).all();
    const course = results[0] as Course | undefined;

    if (!course) return { title: 'Course Not Found | CourseSmart' };

    return {
        title: `${course.title} | CourseSmart`,
        description: course.description,
    };
}

export default async function CourseDetail({ params }: Props) {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);
    const db = await getDb();
    const { results } = await db.prepare('SELECT * FROM courses WHERE id = ?').bind(id).all();
    const course = results[0] as Course | undefined;

    if (!course) notFound();

    const difficulty = typeof course.difficulty === 'string' ? JSON.parse(course.difficulty) : course.difficulty || {};
    const prerequisites = typeof course.prerequisites === 'string' ? JSON.parse(course.prerequisites) : course.prerequisites || [];
    const corequisites = typeof course.corequisites === 'string' ? JSON.parse(course.corequisites) : course.corequisites || [];

    const syllabus = parseSyllabus(course.syllabus_text);
    const learningOutcomes = extractLearningOutcomes(syllabus?.course_learning_outcomes);
    const assessments = syllabus?.assessment_percent || {};

    const courseObjective = Array.isArray(syllabus?.course_objective)
        ? syllabus.course_objective[0]
        : syllabus?.course_objective;

    const getYouTubeId = (url: string | null | undefined): string | null => {
        if (!url) return null;
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        return match ? match[1] : null;
    };
    const videoId = getYouTubeId(course.video_url);

    const difficultyScore = difficulty.weighted_difficulty_score || 0;
    const sections = typeof course.sections === 'string' ? JSON.parse(course.sections || '[]') : course.sections || [];
    const schedule = typeof course.schedule === 'string' ? JSON.parse(course.schedule || '[]') : course.schedule || [];

    return (
        <div className="min-h-screen relative overflow-hidden">
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="gap-2 mb-6 -ml-2 rounded-xl group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        Back to search
                    </Button>
                </Link>

                <header className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-4 flex-wrap">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30 relative">
                                    <GraduationCap className="w-8 h-8" />
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg">
                                        <Zap className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div>
                                    <Badge variant="outline" className="font-mono text-sm rounded-lg mb-1.5 bg-secondary/50">{course.id}</Badge>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {course.su_credits || course.credits} credits
                                        </span>
                                        {course.ects_credits && (
                                            <>
                                                <Separator orientation="vertical" className="h-4" />
                                                <span>{course.ects_credits} ECTS</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                                {course.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 rounded-full shadow-sm">{course.level}</Badge>
                                <Badge variant="secondary" className="rounded-full">{course.major}</Badge>
                                {difficultyScore > 0 && (
                                    <Badge variant="outline" className={cn(
                                        "rounded-full",
                                        difficultyScore >= 4 ? "border-rose-300 text-rose-600 bg-rose-50" :
                                        difficultyScore >= 3 ? "border-amber-300 text-amber-600 bg-amber-50" :
                                        "border-accent/30 text-accent bg-accent/10"
                                    )}>
                                        {difficultyScore >= 4 ? "Challenging" : difficultyScore >= 3 ? "Moderate" : "Beginner-friendly"}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <AddToCalendarBtn course={course} />
                    </div>
                </header>

                {videoId && (
                    <Card className="mb-8 overflow-hidden shadow-xl rounded-2xl border-0">
                        <div className="relative pb-[56.25%] h-0">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                                title={`${course.title} Introduction`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full"
                            />
                        </div>
                    </Card>
                )}

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="w-full justify-start bg-secondary/50 p-1 rounded-2xl h-auto flex-wrap">
                        <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2.5">
                            <Sparkles className="w-4 h-4" />
                            <span className="hidden sm:inline">Overview</span>
                        </TabsTrigger>
                        <TabsTrigger value="schedule" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2.5">
                            <Calendar className="w-4 h-4" />
                            <span className="hidden sm:inline">Schedule</span>
                        </TabsTrigger>
                        <TabsTrigger value="requirements" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2.5">
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">Requirements</span>
                        </TabsTrigger>
                        <TabsTrigger value="grading" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2.5">
                            <BarChart3 className="w-4 h-4" />
                            <span className="hidden sm:inline">Grading</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-primary" />
                                            About this course
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-5">
                                        <p className="text-muted-foreground leading-relaxed">
                                            {course.description}
                                        </p>

                                        {(courseObjective || learningOutcomes.length > 0) && (
                                            <Accordion type="single" collapsible className="w-full">
                                                {courseObjective && (
                                                    <AccordionItem value="objective" className="border-none">
                                                        <AccordionTrigger className="hover:no-underline py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors">
                                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                                <Target className="w-4 h-4 text-amber-500" />
                                                                Course Objective
                                                            </span>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-4 pt-2 pb-4">
                                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                                {courseObjective.length > 500 ? courseObjective.slice(0, 500) + '...' : courseObjective}
                                                            </p>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )}

                                                {learningOutcomes.length > 0 && (
                                                    <AccordionItem value="outcomes" className="border-none">
                                                        <AccordionTrigger className="hover:no-underline py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors">
                                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                                <BookOpen className="w-4 h-4 text-accent" />
                                                                What you&apos;ll learn
                                                            </span>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-4 pt-2 pb-4">
                                                            <ul className="space-y-3">
                                                                {learningOutcomes.map((outcome, idx) => (
                                                                    <li key={idx} className="flex gap-3 text-sm text-muted-foreground">
                                                                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                                                                        <span>{outcome}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )}
                                            </Accordion>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-6">
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">⚡ Difficulty</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {difficultyScore > 0 && (
                                            <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30">
                                                <div className={cn(
                                                    "text-4xl font-bold",
                                                    difficultyScore >= 4 ? "text-rose-500" :
                                                    difficultyScore >= 3 ? "text-amber-500" : "text-accent"
                                                )}>
                                                    {difficultyScore.toFixed(1)}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">out of 5.0</div>
                                            </div>
                                        )}
                                        {[
                                            { label: 'Conceptual Depth', value: difficulty.conceptual_depth, icon: '🧠' },
                                            { label: 'Reading Load', value: difficulty.reading_intensity, icon: '📚' },
                                            { label: 'Project Work', value: difficulty.project_complexity, icon: '🔧' },
                                            { label: 'Assessments', value: difficulty.assessments, icon: '📝' },
                                        ].map(({ label, value, icon }) => value ? (
                                            <div key={label} className="space-y-1.5">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <span>{icon}</span>
                                                        {label}
                                                    </span>
                                                    <span className="font-medium">{value}/5</span>
                                                </div>
                                                <Progress value={(value / 5) * 100} className="h-2 rounded-full" />
                                            </div>
                                        ) : null)}
                                    </CardContent>
                                </Card>

                                <Card className="shadow-lg rounded-2xl">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">📝 Course format</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                {course.has_project ? (
                                                    <CheckCircle2 className="w-4 h-4 text-accent" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                                )}
                                                <span className={!course.has_project ? 'text-muted-foreground' : ''}>Project</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {course.has_quizzes ? (
                                                    <CheckCircle2 className="w-4 h-4 text-accent" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                                )}
                                                <span className={!course.has_quizzes ? 'text-muted-foreground' : ''}>Quizzes</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {course.has_participation ? (
                                                    <CheckCircle2 className="w-4 h-4 text-accent" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                                )}
                                                <span className={!course.has_participation ? 'text-muted-foreground' : ''}>Participation</span>
                                            </div>
                                            <div className="text-muted-foreground">
                                                {course.midterm_count} midterm{course.midterm_count !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="schedule" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {schedule.length > 0 && (
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-sky-500 to-violet-500" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-primary" />
                                            Class Times
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {schedule.map((slot: { day: string; time: string }, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-secondary/50 to-secondary/30 hover:from-secondary/70 hover:to-secondary/50 transition-colors">
                                                <span className="font-medium text-sm">{slot.day}</span>
                                                <Badge variant="outline" className="rounded-lg font-mono text-xs">{slot.time}</Badge>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {sections.length > 0 && (
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            Sections ({sections.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion type="single" collapsible className="w-full">
                                            {sections.map((section: any, idx: number) => (
                                                <AccordionItem key={idx} value={`section-${idx}`} className="border-none">
                                                    <AccordionTrigger className="hover:no-underline py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="outline" className="text-[10px] rounded-lg">Section {section.section}</Badge>
                                                            <span className="text-sm font-medium">{section.instructor}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-4 pt-2 pb-4">
                                                        <div className="space-y-2 text-sm">
                                                            {section.schedule?.map((slot: { day: string; time: string }, slotIdx: number) => (
                                                                <div key={slotIdx} className="flex items-center gap-2 text-muted-foreground">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    <span>{slot.day} {slot.time}</span>
                                                                </div>
                                                            ))}
                                                            {section.location && (
                                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                    <span>{section.location}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="requirements" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {prerequisites.length > 0 && (
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">📚 Prerequisites</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground mb-3">You need to complete these courses first</p>
                                        <div className="flex flex-wrap gap-2">
                                            {prerequisites.map((prereqId: string) => (
                                                <Link key={prereqId} href={`/courses/${encodeURIComponent(prereqId)}`}>
                                                    <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:text-primary rounded-full transition-all hover:scale-105 shadow-sm">
                                                        {prereqId}
                                                    </Badge>
                                                </Link>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {corequisites.length > 0 && corequisites.some((c: string) => c && c !== 'Course Type:') && (
                                <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">🔗 Corequisites (Recitations)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground mb-3">Take these alongside the course</p>
                                        <div className="flex flex-wrap gap-2">
                                            {corequisites.filter((c: string) => c && c !== 'Course Type:').map((coreqId: string) => (
                                                <Badge key={coreqId} variant="outline" className="rounded-full">
                                                    {coreqId}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {prerequisites.length === 0 && (!corequisites.length || !corequisites.some((c: string) => c && c !== 'Course Type:')) && (
                                <Card className="shadow-lg rounded-2xl lg:col-span-2">
                                    <CardContent className="py-12 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-accent" />
                                        </div>
                                        <h3 className="font-semibold mb-2">No prerequisites required</h3>
                                        <p className="text-sm text-muted-foreground">You can take this course right away!</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="grading" className="mt-6">
                        {Object.keys(assessments).length > 0 ? (
                            <Card className="shadow-lg rounded-2xl overflow-hidden">
                                <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-primary" />
                                        Grade Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {Object.entries(assessments).map(([key, value]) => (
                                            <div key={key} className="p-4 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30 hover:from-secondary/70 hover:to-secondary/50 transition-all hover:scale-[1.02] cursor-default">
                                                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{value}%</div>
                                                <div className="text-xs text-muted-foreground capitalize mt-1">
                                                    {key.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="shadow-lg rounded-2xl">
                                <CardContent className="py-12 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                                        <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
                                    </div>
                                    <h3 className="font-semibold mb-2">No grading info available</h3>
                                    <p className="text-sm text-muted-foreground">Check the syllabus for details</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>

                <CourseReviews courseId={course.id} />
            </div>
        </div>
    );
}
