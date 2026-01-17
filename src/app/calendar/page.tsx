'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Search, ChevronLeft, X, Clock, Loader2, Plus, BookOpen, MapPin, User, ChevronDown, GraduationCap, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduleSlot {
    day: string;
    time?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
}

interface Section {
    section: string;
    instructor: string;
    location?: string;
    schedule: ScheduleSlot[];
}

interface Course {
    id: string;
    title: string;
    description?: string;
    schedule?: string | object;
    sections?: string | Section[];
    location?: string;
    professor?: string;
    tags?: string | string[];
    su_credits?: number;
    credits?: number;
    score?: number;
}

interface SelectedCourse extends Course {
    color: string;
    selectedSection?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const COURSES_PER_PAGE = 20;

function toShortDay(day: string): string {
    const idx = DAYS.findIndex(d => d.toLowerCase() === day.toLowerCase());
    return idx >= 0 ? SHORT_DAYS[idx] : day.slice(0, 3);
}

const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => {
    const startHour = 8 + i;
    const endHour = 9 + i;
    return {
        hour: startHour,
        startLabel: `${startHour}:40`,
        endLabel: `${endHour}:30`,
        startMinutes: startHour * 60 + 40
    };
});

function getMinutes(timeStr: string): number {
    const trimmed = timeStr.trim();
    // Check if it's AM/PM format
    if (trimmed.includes('AM') || trimmed.includes('PM')) {
        const [time, period] = trimmed.split(' ');
        const [hoursStr, minutesStr] = time.split(':');
        let hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }
    // 24-hour format (e.g., "09:40" or "14:30")
    const [hoursStr, minutesStr] = trimmed.split(':');
    return Number(hoursStr) * 60 + Number(minutesStr);
}

function parseSections(sections: string | Section[] | undefined): Section[] {
    if (!sections) return [];
    if (typeof sections === 'string') {
        try { return JSON.parse(sections); } catch { return []; }
    }
    return Array.isArray(sections) ? sections : [];
}

function parseSchedule(schedule: string | object | undefined): ScheduleSlot[] {
    if (!schedule) return [];
    if (typeof schedule === 'string') {
        try { return JSON.parse(schedule); } catch { return []; }
    }
    return Array.isArray(schedule) ? schedule : [];
}

function mapTimeToSlots(timeStr: string): { startIndex: number; span: number } | null {
    try {
        const [startStr, endStr] = timeStr.split(' - ');
        const startMinutes = getMinutes(startStr);
        const endMinutes = getMinutes(endStr);
        const startIndex = Math.round((startMinutes - 520) / 60);
        const endIndex = Math.round((endMinutes - 50 - 520) / 60);
        const span = endIndex - startIndex + 1;
        if (startIndex < 0 || startIndex >= 11 || span < 1) return null;
        return { startIndex, span };
    } catch { return null; }
}

interface ScraperCourse {
    subject_code: string;
    class_number: string;
    sections: Section[];
}

function transformScraperData(scraperData: ScraperCourse[]): Course[] {
    // Separate regular courses from recitations (R) and labs (L)
    const regularCourses: Map<string, ScraperCourse> = new Map();
    const recitations: Map<string, ScraperCourse> = new Map();
    const labs: Map<string, ScraperCourse> = new Map();

    for (const course of scraperData) {
        const id = `${course.subject_code}${course.class_number}`;
        // Check if it's a recitation (ends with R followed by optional digits, e.g., CS201R, MATH101R1)
        const recitMatch = course.class_number.match(/^(\d+)R(\d*)$/);
        // Check if it's a lab (ends with L followed by optional digits, e.g., CS201L, PHYS101L1)
        const labMatch = course.class_number.match(/^(\d+)L(\d*)$/);
        if (recitMatch) {
            recitations.set(id, course);
        } else if (labMatch) {
            labs.set(id, course);
        } else {
            regularCourses.set(id, course);
        }
    }

    // Merge recitations and labs into their parent courses
    const mergedCourses: Course[] = [];

    for (const [id, course] of regularCourses) {
        // Find matching recitation (e.g., CS201 -> CS201R)
        const recitId = `${course.subject_code}${course.class_number}R`;
        const recitation = recitations.get(recitId);

        // Find matching lab (e.g., CS201 -> CS201L)
        const labId = `${course.subject_code}${course.class_number}L`;
        const lab = labs.get(labId);

        // Combine sections - mark recitation sections with R prefix and lab sections with L prefix
        let allSections = [...(course.sections || [])];

        if (recitation && recitation.sections) {
            // Add recitation sections with R prefix to distinguish them
            const recitSections = recitation.sections.map(s => ({
                ...s,
                section: `R${s.section}`, // Prefix with R to indicate recitation
                instructor: s.instructor || 'TBA',
            }));
            allSections = [...allSections, ...recitSections];
        }

        if (lab && lab.sections) {
            // Add lab sections with L prefix to distinguish them
            const labSections = lab.sections.map(s => ({
                ...s,
                section: `L${s.section}`, // Prefix with L to indicate lab
                instructor: s.instructor || 'TBA',
            }));
            allSections = [...allSections, ...labSections];
        }

        mergedCourses.push({
            id,
            title: `${course.subject_code} ${course.class_number}`,
            sections: allSections,
            credits: 3,
        });
    }

    return mergedCourses;
}

const COLORS = [
    { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', light: 'bg-orange-50', gradient: 'from-orange-500 to-orange-600' },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', light: 'bg-teal-50', gradient: 'from-teal-500 to-teal-600' },
    { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', light: 'bg-amber-50', gradient: 'from-amber-500 to-amber-600' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800', light: 'bg-rose-50', gradient: 'from-rose-500 to-rose-600' },
    { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-800', light: 'bg-sky-50', gradient: 'from-sky-500 to-sky-600' },
    { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800', light: 'bg-violet-50', gradient: 'from-violet-500 to-violet-600' },
];

export default function CalendarPage() {
    const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [displayedCourses, setDisplayedCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasMore, setHasMore] = useState(false);
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const savedBio = localStorage.getItem('search_bio') || '';
                const savedCareer = localStorage.getItem('search_career') || '';
                const savedPastCourses = localStorage.getItem('search_pastCourseIds');
                const pastCoursesStr = savedPastCourses ? JSON.parse(savedPastCourses).join(', ') : '';

                let loadedFromApi = false;
                try {
                    const res = await fetch('/api/recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bio: savedBio, career: savedCareer, pastCourses: pastCoursesStr, limit: 500, offset: 0 }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const courses = data.courses || [];
                        if (courses.length > 0) {
                            setAllCourses(courses.sort((a: Course, b: Course) => (b.score || 0) - (a.score || 0)));
                            loadedFromApi = true;
                        }
                    }
                } catch (apiErr) {
                    console.error('API fetch failed:', apiErr);
                }

                // Fallback: load from local courses.json for testing
                if (!loadedFromApi) {
                    try {
                        const localRes = await fetch('/courses.json');
                        if (localRes.ok) {
                            const scraperData = await localRes.json();
                            const courses = transformScraperData(scraperData);
                            setAllCourses(courses);
                        }
                    } catch (localErr) {
                        console.error('Failed to load local courses:', localErr);
                    }
                }
            } finally {
                setLoadingCourses(false);
            }
        };
        fetchCourses();

        const savedSelected = localStorage.getItem('selectedCourses');
        if (savedSelected) {
            try { setSelectedCourses(JSON.parse(savedSelected)); } catch {}
        }
        setIsLoaded(true);

        const checkWidth = () => {
            if (window.innerWidth >= 1024) setShowSidebar(true);
        };
        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    const filteredCourses = useMemo(() => {
        return allCourses
            .filter(c => {
                // Don't hide courses - allow adding multiple sections from the same course
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase().replace(/\s+/g, '');
                const idNorm = c.id.toLowerCase().replace(/\s+/g, '');
                const titleLower = c.title.toLowerCase();
                return idNorm.includes(query) || titleLower.includes(searchQuery.toLowerCase());
            })
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [allCourses, searchQuery]);

    useEffect(() => {
        setDisplayedCourses(filteredCourses.slice(0, COURSES_PER_PAGE));
        setHasMore(filteredCourses.length > COURSES_PER_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, allCourses]);

    const loadMoreCourses = useCallback(() => {
        const currentLength = displayedCourses.length;
        const nextCourses = filteredCourses.slice(currentLength, currentLength + COURSES_PER_PAGE);
        if (nextCourses.length > 0) {
            setDisplayedCourses(prev => [...prev, ...nextCourses]);
            setHasMore(currentLength + nextCourses.length < filteredCourses.length);
        } else {
            setHasMore(false);
        }
    }, [filteredCourses, displayedCourses.length]);

    useEffect(() => {
        if (!hasMore || loadingCourses) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) loadMoreCourses(); },
            { threshold: 0.1 }
        );
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingCourses, loadMoreCourses]);

    useEffect(() => {
        if (!isLoaded) return;
        if (selectedCourses.length > 0) {
            const slimCourses = selectedCourses.map(c => ({
                id: c.id,
                title: c.title,
                su_credits: c.su_credits,
                credits: c.credits,
                schedule: c.schedule,
                sections: c.sections,
                color: c.color,
                selectedSection: c.selectedSection,
                score: c.score,
            }));
            localStorage.setItem('selectedCourses', JSON.stringify(slimCourses));
        } else {
            localStorage.removeItem('selectedCourses');
        }
    }, [selectedCourses, isLoaded]);

    const getSectionLabel = (sectionId: string | undefined, forToast: boolean = false): string => {
        if (!sectionId) return '';
        if (sectionId.startsWith('R')) {
            return forToast ? ` (Section ${sectionId.slice(1)} - Recitation)` : ` Section ${sectionId.slice(1)}`;
        }
        if (sectionId.startsWith('L')) {
            return forToast ? ` (Section ${sectionId.slice(1)} - Lab)` : ` Section ${sectionId.slice(1)}`;
        }
        return forToast ? ` (Section ${sectionId})` : ` Section ${sectionId}`;
    };

    const addCourse = (course: Course, sectionId?: string) => {
        // Check if this exact course+section combination already exists
        if (selectedCourses.some(c => c.id === course.id && c.selectedSection === sectionId)) {
            toast.info(`${course.id} Section ${sectionId} is already added`);
            return;
        }
        setSelectedCourses(prev => [...prev, { ...course, color: '#f97316', selectedSection: sectionId }]);
        // Don't close expanded view - keep it open so user can add more sections
        if (window.innerWidth < 1024) setShowSidebar(false);
        toast.success(`Added ${course.id}${getSectionLabel(sectionId, true)}`, { description: course.title });
    };

    const removeCourse = (courseId: string, sectionId?: string) => {
        setSelectedCourses(prev => prev.filter(c => !(c.id === courseId && c.selectedSection === sectionId)));
        toast.info(`Removed ${courseId}${getSectionLabel(sectionId)}`);
    };

    const changeSection = (courseId: string, sectionId: string) => {
        setSelectedCourses(prev => prev.map(c => 
            c.id === courseId ? { ...c, selectedSection: sectionId } : c
        ));
    };

    const formatSlotTime = (slot: ScheduleSlot): string => {
        if (slot.start_time && slot.end_time) {
            return `${slot.start_time} - ${slot.end_time}`;
        }
        return slot.time || '';
    };

    const getScheduleForCourse = (course: SelectedCourse): { day: string; time: string; location?: string }[] => {
        const sections = parseSections(course.sections);
        if (sections.length > 0 && course.selectedSection) {
            const section = sections.find(s => s.section === course.selectedSection);
            if (section && section.schedule) {
                return section.schedule.filter(s => s != null && s.day).map(s => ({
                    day: toShortDay(s.day),
                    time: formatSlotTime(s),
                    location: s.location || section.location
                }));
            }
        }
        if (sections.length > 0 && sections[0].schedule) {
            return sections[0].schedule.filter(s => s != null && s.day).map(s => ({
                day: toShortDay(s.day),
                time: formatSlotTime(s),
                location: s.location || sections[0].location
            }));
        }
        const schedule = parseSchedule(course.schedule);
        return schedule.filter(s => s != null && s.day).map(s => ({
            day: toShortDay(s.day),
            time: formatSlotTime(s),
            location: s.location
        }));
    };

    const courseBlocks = useMemo(() => {
        return selectedCourses.flatMap((course, courseIdx) => {
            const scheduleData = getScheduleForCourse(course);
            return scheduleData.map((slot) => {
                const slotInfo = mapTimeToSlots(slot.time);
                if (!slotInfo) return null;
                return { ...slot, course, slotInfo, colorIdx: courseIdx % COLORS.length };
            }).filter(Boolean);
        });
    }, [selectedCourses]);

    const getOverlapInfo = useCallback((day: string, slotIdx: number) => {
        const blocksAtSlot: any[] = [];
        courseBlocks.forEach((block: any) => {
            if (block.day === day) {
                const startIdx = block.slotInfo.startIndex;
                const endIdx = startIdx + block.slotInfo.span - 1;
                if (slotIdx >= startIdx && slotIdx <= endIdx) blocksAtSlot.push(block);
            }
        });
        return blocksAtSlot;
    }, [courseBlocks]);

    const getBlockPosition = useCallback((block: any, day: string) => {
        const overlapping = getOverlapInfo(day, block.slotInfo.startIndex);
        const idx = overlapping.findIndex((b: any) =>
            b.course.id === block.course.id &&
            b.course.selectedSection === block.course.selectedSection &&
            b.time === block.time
        );
        return { idx, total: overlapping.length };
    }, [getOverlapInfo]);

    const hasConflicts = useMemo(() => {
        return courseBlocks.some((block: any) => {
            const { total } = getBlockPosition(block, block.day);
            return total > 1;
        });
    }, [courseBlocks, getBlockPosition]);

    const totalCredits = useMemo(() => 
        selectedCourses.reduce((sum, c) => sum + (c.su_credits || c.credits || 0), 0),
        [selectedCourses]
    );

    if (!isLoaded) return null;

    return (
        <TooltipProvider delayDuration={300}>
            <div className="min-h-screen bg-background flex flex-col">
                <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                    <div className="flex h-14 items-center px-4 gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="gap-2 rounded-xl group">
                                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                                <span className="hidden sm:inline">Back</span>
                            </Button>
                        </Link>

                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                                <GraduationCap className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold hidden sm:inline">Schedule Builder</span>
                        </div>

                        <div className="ml-auto flex items-center gap-4">
                            {hasConflicts && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Conflicts</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Some courses have overlapping times</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
                                <span><strong className="text-foreground">{selectedCourses.length}</strong> courses</span>
                                <span>•</span>
                                <span><strong className="text-foreground">{totalCredits}</strong> credits</span>
                            </div>
                            <Button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className={cn(
                                    "gap-2 rounded-xl transition-all",
                                    showSidebar ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-gradient-to-r from-primary to-primary/90"
                                )}
                            >
                                <Plus className={cn("h-4 w-4 transition-transform", showSidebar && "rotate-45")} />
                                <span className="hidden sm:inline">{showSidebar ? 'Close' : 'Add Courses'}</span>
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden relative">
                    {showSidebar && (
                        <>
                            <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
                            <aside className="fixed lg:relative inset-y-0 left-0 top-14 w-[85%] sm:w-96 border-r flex flex-col bg-card z-50 lg:z-auto shadow-2xl lg:shadow-none h-[calc(100vh-56px)]">
                                <div className="p-4 border-b bg-gradient-to-r from-secondary/50 to-secondary/30 shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Search courses..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-10 rounded-xl bg-background"
                                        />
                                    </div>
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="p-3 space-y-2">
                                    {loadingCourses ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm">Loading courses...</p>
                                        </div>
                                    ) : displayedCourses.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                            <p className="text-sm text-muted-foreground">No courses found</p>
                                        </div>
                                    ) : (
                                        <>
                                            {displayedCourses.map((course) => {
                                                const matchPercent = course.score ? Math.round(course.score * 100) : null;
                                                const sections = parseSections(course.sections);
                                                const scheduleItems = sections.length > 0
                                                    ? sections.flatMap(s => s.schedule || []).filter(s => s != null)
                                                    : parseSchedule(course.schedule).filter(s => s != null);
                                                const isExcellent = matchPercent && matchPercent >= 85;
                                                const isGreat = matchPercent && matchPercent >= 70 && matchPercent < 85;
                                                const isGood = matchPercent && matchPercent >= 55 && matchPercent < 70;
                                                const isExpanded = expandedCourse === course.id;
                                                const hasSections = sections.length > 1;

                                                return (
                                                    <Card
                                                        key={course.id}
                                                        className="overflow-hidden transition-all shadow-sm hover:shadow-md group"
                                                    >
                                                        <div
                                                            onClick={() => hasSections ? setExpandedCourse(isExpanded ? null : course.id) : addCourse(course)}
                                                            className="p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                                                        >
                                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                <Badge variant="outline" className="font-mono text-[10px] rounded-lg bg-secondary/50 text-foreground">{course.id}</Badge>
                                                                <div className="flex items-center gap-2">
                                                                    {matchPercent !== null && matchPercent > 0 && (
                                                                        <span className={cn(
                                                                            "text-[10px] font-bold px-2 py-0.5 rounded-lg",
                                                                            isExcellent ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" :
                                                                            isGreat ? "bg-sky-500/20 text-sky-700 dark:text-sky-300" :
                                                                            isGood ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" :
                                                                            "bg-secondary text-foreground/70"
                                                                        )}>
                                                                            {matchPercent}%
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] text-foreground/60 font-medium">
                                                                        {course.su_credits || course.credits || 0} cr
                                                                    </span>
                                                                    {hasSections && (
                                                                        <ChevronDown className={cn("w-4 h-4 text-foreground/50 transition-transform", isExpanded && "rotate-180")} />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">{course.title}</h3>
                                                            {scheduleItems.length > 0 && (
                                                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-foreground/60 font-medium">
                                                                    <Clock className="w-3 h-3 text-primary/70" />
                                                                    {[...new Set(scheduleItems.filter(s => s?.day).map(s => s.day.slice(0, 3)))].join(', ')}
                                                                    {hasSections && <span className="ml-1">• {sections.length} sections</span>}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isExpanded && hasSections && (() => {
                                                            const regularSections = sections.filter(s => !s.section.startsWith('R') && !s.section.startsWith('L'));
                                                            const recitationSections = sections.filter(s => s.section.startsWith('R'));
                                                            const labSections = sections.filter(s => s.section.startsWith('L'));

                                                            const renderSection = (section: any, displayName: string) => {
                                                                const isAdded = selectedCourses.some(c => c.id === course.id && c.selectedSection === section.section);
                                                                return (
                                                                    <div
                                                                        key={section.section}
                                                                        onClick={() => !isAdded && addCourse(course, section.section)}
                                                                        className={cn(
                                                                            "p-3 rounded-xl border transition-all group/section",
                                                                            isAdded
                                                                                ? "bg-primary/10 border-primary/30 cursor-default"
                                                                                : "bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center justify-between mb-1.5">
                                                                            <Badge variant="outline" className={cn(
                                                                                "text-[10px] rounded-lg font-semibold",
                                                                                isAdded ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/50 text-foreground"
                                                                            )}>
                                                                                Section {displayName}
                                                                            </Badge>
                                                                            {isAdded ? (
                                                                                <Badge variant="secondary" className="h-6 text-[10px] rounded-lg bg-primary/20 text-primary">
                                                                                    Added
                                                                                </Badge>
                                                                            ) : (
                                                                                <Button size="sm" className="h-6 text-[10px] rounded-lg opacity-0 group-hover/section:opacity-100 transition-opacity">
                                                                                    <Plus className="w-3 h-3 mr-1" />
                                                                                    Add
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs font-medium flex items-center gap-1.5 mb-1 text-foreground">
                                                                            <User className="w-3 h-3 text-primary" />
                                                                            {section.instructor}
                                                                        </div>
                                                                        <div className="text-[10px] text-foreground/70 flex flex-col gap-0.5">
                                                                            {section.schedule?.filter((s: any) => s != null).map((s: any, i: number) => (
                                                                                <div key={i} className="flex items-center gap-1">
                                                                                    <Clock className="w-3 h-3 text-primary/70" />
                                                                                    <span>{s.day?.slice(0, 3)} {s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : s.time}</span>
                                                                                    {s.location && (
                                                                                        <>
                                                                                            <MapPin className="w-3 h-3 text-primary/70 ml-1" />
                                                                                            <span>{s.location}</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            };

                                                            return (
                                                                <div className="border-t bg-secondary/30 p-2 space-y-1.5">
                                                                    {regularSections.length > 0 && (
                                                                        <>
                                                                            <div className="text-[10px] font-semibold text-foreground/70 px-1 pt-1">Sections</div>
                                                                            {regularSections.map((section) => renderSection(section, section.section))}
                                                                        </>
                                                                    )}
                                                                    {recitationSections.length > 0 && (
                                                                        <>
                                                                            <div className="text-[10px] font-semibold text-foreground/70 px-1 pt-2">Sections (R)</div>
                                                                            {recitationSections.map((section) => renderSection(section, section.section.slice(1)))}
                                                                        </>
                                                                    )}
                                                                    {labSections.length > 0 && (
                                                                        <>
                                                                            <div className="text-[10px] font-semibold text-foreground/70 px-1 pt-2">Sections (L)</div>
                                                                            {labSections.map((section) => renderSection(section, section.section.slice(1)))}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </Card>
                                                );
                                            })}
                                            {hasMore && (
                                                <div ref={loaderRef} className="py-6 flex justify-center">
                                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                </div>
                                            )}
                                        </>
                                    )}
                                    </div>
                                </ScrollArea>
                            </aside>
                        </>
                    )}

                    <main className="flex-1 overflow-auto p-4 sm:p-6">
                        <div className="max-w-6xl mx-auto space-y-5">
                            <Card className="overflow-hidden shadow-xl rounded-2xl border-0">
                                    <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                                    <div className="overflow-x-auto h-full">
                                        <div className="min-w-[650px]">
                                            <div className="grid grid-cols-[70px_repeat(5,1fr)] border-b bg-gradient-to-r from-secondary/50 to-secondary/30">
                                                <div className="p-3 flex items-center justify-center border-r">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                {DAYS.map((day, i) => (
                                                    <div key={day} className="p-3 text-center text-xs font-semibold border-r last:border-r-0">
                                                        <span className="hidden sm:inline">{day}</span>
                                                        <span className="sm:hidden">{SHORT_DAYS[i]}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-[70px_repeat(5,1fr)] auto-rows-[56px]">
                                                {TIME_SLOTS.map((slot, slotIdx) => (
                                                    <Fragment key={`row-${slot.hour}`}>
                                                        <div className="border-r border-b px-1 py-1.5 text-[9px] font-medium text-muted-foreground flex flex-col items-center justify-center bg-secondary/20">
                                                            <span className="text-foreground font-semibold">{slot.startLabel}</span>
                                                            <span className="text-[8px]">to {slot.endLabel}</span>
                                                        </div>
                                                        {SHORT_DAYS.map((day) => {
                                                            const coursesHere = courseBlocks.filter((block: any) =>
                                                                block.day === day && block.slotInfo.startIndex === slotIdx
                                                            );
                                                            return (
                                                                <div key={`${day}-${slot.hour}`} className="relative border-r border-b last:border-r-0 bg-card">
                                                                    {coursesHere.map((block: any) => {
                                                                        const { idx: overlapIdx, total: overlapTotal } = getBlockPosition(block, day);
                                                                        const widthPercent = 100 / overlapTotal;
                                                                        const leftPercent = overlapIdx * widthPercent;
                                                                        const isOverlapping = overlapTotal > 1;
                                                                        const color = COLORS[block.colorIdx];
                                                                        const sections = parseSections(block.course.sections);
                                                                        const currentSection = block.course.selectedSection
                                                                            ? sections.find((s: Section) => s.section === block.course.selectedSection)
                                                                            : sections[0];

                                                                        return (
                                                                            <HoverCard key={`${block.course.id}-${block.course.selectedSection}-${block.time}`} openDelay={200} closeDelay={100}>
                                                                                <HoverCardTrigger asChild>
                                                                                    <Link
                                                                                        href={`/courses/${encodeURIComponent(block.course.id)}`}
                                                                                        className={cn(
                                                                                            "absolute rounded-xl border-2 p-1.5 overflow-hidden hover:z-20 transition-all hover:shadow-lg group",
                                                                                            color.bg, color.border, color.text
                                                                                        )}
                                                                                        style={{
                                                                                            top: '2px',
                                                                                            left: isOverlapping ? `calc(${leftPercent}% + 2px)` : '2px',
                                                                                            width: isOverlapping ? `calc(${widthPercent}% - 4px)` : 'calc(100% - 4px)',
                                                                                            height: `calc(${block.slotInfo.span * 100}% + ${(block.slotInfo.span - 1)}px - 4px)`,
                                                                                            zIndex: 10 + overlapIdx,
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-start justify-between gap-0.5">
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span className={cn("font-bold leading-none truncate", isOverlapping ? "text-[8px]" : "text-[10px]")}>
                                                                                                    {block.course.id}
                                                                                                </span>
                                                                                                {block.course.selectedSection && (
                                                                                                    <span className={cn(
                                                                                                        "font-medium opacity-80 truncate",
                                                                                                        isOverlapping ? "text-[7px]" : "text-[8px]"
                                                                                                    )}>
                                                                                                        {block.course.selectedSection.startsWith('R')
                                                                                                            ? `R-${block.course.selectedSection.slice(1)}`
                                                                                                            : block.course.selectedSection.startsWith('L')
                                                                                                                ? `L-${block.course.selectedSection.slice(1)}`
                                                                                                                : `S-${block.course.selectedSection}`
                                                                                                        }
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.preventDefault();
                                                                                                    e.stopPropagation();
                                                                                                    removeCourse(block.course.id, block.course.selectedSection);
                                                                                                }}
                                                                                                className={cn(
                                                                                                    "opacity-0 group-hover:opacity-100 rounded-full bg-white/90 hover:bg-destructive hover:text-white flex items-center justify-center transition-all shrink-0 shadow-sm",
                                                                                                    isOverlapping ? "h-3 w-3" : "h-4 w-4"
                                                                                                )}
                                                                                            >
                                                                                                <X className={cn(isOverlapping ? "h-2 w-2" : "h-2.5 w-2.5")} />
                                                                                            </button>
                                                                                        </div>
                                                                                        {!isOverlapping && (
                                                                                            <div className={cn("font-medium mt-0.5 truncate text-[9px]")}>
                                                                                                {block.course.title}
                                                                                            </div>
                                                                                        )}
                                                                                        {isOverlapping && (
                                                                                            <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                                                                                        )}
                                                                                    </Link>
                                                                                </HoverCardTrigger>
                                                                                <HoverCardContent className="w-72 p-0 rounded-2xl overflow-hidden" side="right" align="start">
                                                                                    <div className={cn("h-1.5 bg-gradient-to-r", color.gradient)} />
                                                                                    <div className="p-4">
                                                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                                            <Badge variant="outline" className="font-mono text-xs rounded-lg">{block.course.id}</Badge>
                                                                                            {block.course.selectedSection && (
                                                                                                <Badge
                                                                                                    variant="secondary"
                                                                                                    className={cn(
                                                                                                        "text-[10px] rounded-lg",
                                                                                                        block.course.selectedSection.startsWith('R')
                                                                                                            ? "bg-amber-100 text-amber-800"
                                                                                                            : block.course.selectedSection.startsWith('L')
                                                                                                                ? "bg-emerald-100 text-emerald-800"
                                                                                                                : "bg-sky-100 text-sky-800"
                                                                                                    )}
                                                                                                >
                                                                                                    {block.course.selectedSection.startsWith('R')
                                                                                                        ? `Recitation ${block.course.selectedSection.slice(1)}`
                                                                                                        : block.course.selectedSection.startsWith('L')
                                                                                                            ? `Lab ${block.course.selectedSection.slice(1)}`
                                                                                                            : `Section ${block.course.selectedSection}`
                                                                                                    }
                                                                                                </Badge>
                                                                                            )}
                                                                                            <span className="text-xs text-muted-foreground">{block.course.su_credits || block.course.credits || 0} credits</span>
                                                                                        </div>
                                                                                        <h4 className="font-semibold text-sm mb-2">{block.course.title}</h4>
                                                                                        {block.course.description && (
                                                                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{block.course.description}</p>
                                                                                        )}
                                                                                        <div className="space-y-1.5 text-xs">
                                                                                            {currentSection && (
                                                                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                                                                    <User className="w-3.5 h-3.5 text-primary" />
                                                                                                    <span>{currentSection.instructor}</span>
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                                                <Clock className="w-3.5 h-3.5 text-primary" />
                                                                                                <span>{block.time}</span>
                                                                                            </div>
                                                                                            {block.location && (
                                                                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                                                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                                                                                    <span>{block.location}</span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </HoverCardContent>
                                                                            </HoverCard>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}
                                                    </Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                            <Card className="shadow-lg rounded-2xl overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-primary" />
                                                Your Courses
                                            </h3>
                                            <Badge variant="secondary" className="rounded-full">{totalCredits} credits</Badge>
                                        </div>
                                        {selectedCourses.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center text-center py-8">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                                                    <BookOpen className="w-8 h-8 text-primary" />
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-4">No courses added yet</p>
                                                <Button onClick={() => setShowSidebar(true)} size="sm" className="gap-2 rounded-xl">
                                                    <Plus className="h-4 w-4" />
                                                    Add courses
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {selectedCourses.map((course, idx) => {
                                                        const color = COLORS[idx % COLORS.length];
                                                        const sections = parseSections(course.sections);
                                                        const hasSections = sections.length > 1;
                                                        const currentSection = course.selectedSection 
                                                            ? sections.find(s => s.section === course.selectedSection)
                                                            : sections[0];
                                                        const schedule = getScheduleForCourse(course);
                                                        const matchPercent = course.score ? Math.round(course.score * 100) : null;

                                                        return (
                                                            <Card
                                                                key={`${course.id}-${course.selectedSection}`}
                                                                className={cn("overflow-hidden shadow-sm hover:shadow-md transition-all border-l-4", color.border)}
                                                            >
                                                                <CardContent className="p-3">
                                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                                        <Link href={`/courses/${encodeURIComponent(course.id)}`} className="flex-1 min-w-0 group">
                                                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                <Badge variant="outline" className="font-mono text-[10px] rounded">{course.id}</Badge>
                                                                                <span className="text-[10px] text-muted-foreground">
                                                                                    {course.su_credits || course.credits || 0} cr
                                                                                </span>
                                                                                {matchPercent && matchPercent > 0 && (
                                                                                    <span className={cn(
                                                                                        "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                                                                                        matchPercent >= 85 ? "bg-cyan-500/15 text-cyan-600" :
                                                                                        matchPercent >= 70 ? "bg-sky-500/15 text-sky-600" :
                                                                                        "bg-indigo-500/15 text-indigo-600"
                                                                                    )}>
                                                                                        {matchPercent}%
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h4 className="font-semibold text-xs group-hover:text-primary transition-colors line-clamp-1">{course.title}</h4>
                                                                        </Link>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 shrink-0 rounded hover:bg-destructive/10 hover:text-destructive"
                                                                            onClick={() => removeCourse(course.id, course.selectedSection)}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                        {currentSection && (
                                                                            <span className="flex items-center gap-1">
                                                                                <User className="w-3 h-3" />
                                                                                {currentSection.instructor}
                                                                            </span>
                                                                        )}
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock className="w-3 h-3" />
                                                                            {[...new Set(schedule.map(s => s.day.slice(0, 3)))].join(', ')}
                                                                        </span>
                                                                    </div>

                                                                    {hasSections && (
                                                                        <div onClick={(e) => e.stopPropagation()} className="mt-2 pt-2 border-t">
                                                                            <Select
                                                                                value={course.selectedSection || sections[0]?.section}
                                                                                onValueChange={(value) => changeSection(course.id, value)}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-[10px] rounded border">
                                                                                    <SelectValue placeholder="Section" />
                                                                                </SelectTrigger>
                                                                                <SelectContent className="rounded-lg">
                                                                                    {sections.map(s => (
                                                                                        <SelectItem 
                                                                                            key={s.section} 
                                                                                            value={s.section}
                                                                                            className="text-xs py-2"
                                                                                        >
                                                                                            <span className="font-mono">{s.section}</span>
                                                                                            <span className="mx-1">·</span>
                                                                                            <span>{s.instructor}</span>
                                                                                            <span className="mx-1">·</span>
                                                                                            <span className="text-muted-foreground">
                                                                                                {(s.schedule || []).filter(slot => slot != null && slot.day).map(slot => `${slot.day.slice(0, 3)} ${slot.start_time || (slot.time ? slot.time.split(' - ')[0] : '')}`).join(', ')}
                                                                                            </span>
                                                                                            {s.location && (
                                                                                                <>
                                                                                                    <span className="mx-1">·</span>
                                                                                                    <span className="text-muted-foreground">{s.location.split(',')[0]}</span>
                                                                                                </>
                                                                                            )}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                        </div>
                    </main>
                </div>
            </div>
        </TooltipProvider>
    );
}
