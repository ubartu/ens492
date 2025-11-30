'use client';

export const runtime = 'edge';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ArrowLeft, Loader2, Save, Shield, Clock, MapPin, User, BookOpen,
    GraduationCap, FileText, Video, Tag, Brain, CheckSquare, X, Plus
} from "lucide-react";
import { toast } from "sonner";

interface Section {
    section: string;
    instructor: string;
    location: string;
    schedule: { day: string; time: string }[];
}

interface Difficulty {
    weighted_difficulty_score?: number;
    conceptual_depth?: number;
    reading_intensity?: number;
    project_complexity?: number;
    assessments?: number;
}

interface Course {
    id: string;
    title: string;
    description: string;
    professor: string;
    location: string;
    schedule: string;
    sections: string;
    level: string;
    major: string;
    credits: number;
    su_credits: number;
    ects_credits: number;
    basic_science_credits: number;
    engineering_credits: number;
    tags: string;
    key_topics: string;
    midterm_count: number;
    has_project: boolean;
    has_quizzes: boolean;
    has_participation: boolean;
    prerequisites: string;
    corequisites: string;
    video_url: string;
    main_textbooks: string;
    syllabus_text: string;
    difficulty: string;
}

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [course, setCourse] = useState<Course | null>(null);
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        professor: '',
        location: '',
        level: '',
        major: '',
        credits: 0,
        su_credits: 0,
        ects_credits: 0,
        basic_science_credits: 0,
        engineering_credits: 0,
        midterm_count: 0,
        has_project: false,
        has_quizzes: false,
        has_participation: false,
        video_url: '',
    });
    
    const [sections, setSections] = useState<Section[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [keyTopics, setKeyTopics] = useState<string[]>([]);
    const [prerequisites, setPrerequisites] = useState<string[]>([]);
    const [corequisites, setCorequisites] = useState<string[]>([]);
    const [mainTextbooks, setMainTextbooks] = useState<string[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>({});
    const [syllabusText, setSyllabusText] = useState('');
    
    const [newTag, setNewTag] = useState('');
    const [newTopic, setNewTopic] = useState('');
    const [newPrereq, setNewPrereq] = useState('');
    const [newCoreq, setNewCoreq] = useState('');
    const [newTextbook, setNewTextbook] = useState('');
    
    const router = useRouter();

    useEffect(() => {
        const storedToken = localStorage.getItem('admin_token');
        if (!storedToken) {
            router.push('/admin');
            return;
        }

        fetch('/api/admin/auth', {
            headers: { 'Authorization': `Bearer ${storedToken}` }
        }).then(res => {
            if (res.ok) {
                setToken(storedToken);
            } else {
                localStorage.removeItem('admin_token');
                router.push('/admin');
            }
        }).catch(() => router.push('/admin'));
    }, [router]);

    useEffect(() => {
        if (!token) return;

        const fetchCourse = async () => {
            try {
                const res = await fetch(`/api/admin/courses/${encodeURIComponent(id)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) {
                    toast.error('Course not found');
                    router.push('/admin/dashboard');
                    return;
                }
                
                const data = await res.json();
                const c = data.course;
                setCourse(c);
                
                setFormData({
                    title: c.title || '',
                    description: c.description || '',
                    professor: c.professor || '',
                    location: c.location || '',
                    level: c.level || '',
                    major: c.major || '',
                    credits: c.credits || 0,
                    su_credits: c.su_credits || 0,
                    ects_credits: c.ects_credits || 0,
                    basic_science_credits: c.basic_science_credits || 0,
                    engineering_credits: c.engineering_credits || 0,
                    midterm_count: c.midterm_count || 0,
                    has_project: !!c.has_project,
                    has_quizzes: !!c.has_quizzes,
                    has_participation: !!c.has_participation,
                    video_url: c.video_url || '',
                });
                
                try {
                    setSections(typeof c.sections === 'string' ? JSON.parse(c.sections || '[]') : c.sections || []);
                } catch { setSections([]); }
                
                try {
                    setTags(typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : c.tags || []);
                } catch { setTags([]); }
                
                try {
                    setKeyTopics(typeof c.key_topics === 'string' ? JSON.parse(c.key_topics || '[]') : c.key_topics || []);
                } catch { setKeyTopics([]); }
                
                try {
                    setPrerequisites(typeof c.prerequisites === 'string' ? JSON.parse(c.prerequisites || '[]') : c.prerequisites || []);
                } catch { setPrerequisites([]); }
                
                try {
                    setCorequisites(typeof c.corequisites === 'string' ? JSON.parse(c.corequisites || '[]') : c.corequisites || []);
                } catch { setCorequisites([]); }
                
                try {
                    setMainTextbooks(typeof c.main_textbooks === 'string' ? JSON.parse(c.main_textbooks || '[]') : c.main_textbooks || []);
                } catch { setMainTextbooks([]); }
                
                try {
                    setDifficulty(typeof c.difficulty === 'string' ? JSON.parse(c.difficulty || '{}') : c.difficulty || {});
                } catch { setDifficulty({}); }
                
                setSyllabusText(c.syllabus_text || '');
                
            } catch {
                toast.error('Failed to load course');
            } finally {
                setLoading(false);
            }
        };

        fetchCourse();
    }, [token, id, router]);

    const handleSave = async () => {
        if (!token || !course) return;
        setSaving(true);

        try {
            const res = await fetch('/api/admin/courses', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: course.id,
                    ...formData,
                    sections: JSON.stringify(sections),
                    tags: JSON.stringify(tags),
                    key_topics: JSON.stringify(keyTopics),
                    prerequisites: JSON.stringify(prerequisites),
                    corequisites: JSON.stringify(corequisites),
                    main_textbooks: JSON.stringify(mainTextbooks),
                    difficulty: JSON.stringify(difficulty),
                    syllabus_text: syllabusText,
                })
            });

            if (res.ok) {
                toast.success('Course updated successfully');
            } else {
                toast.error('Failed to update course');
            }
        } catch {
            toast.error('Save failed');
        } finally {
            setSaving(false);
        }
    };

    const updateSection = (index: number, field: keyof Section, value: any) => {
        setSections(prev => prev.map((s, i) => 
            i === index ? { ...s, [field]: value } : s
        ));
    };

    const updateSectionSchedule = (sectionIndex: number, scheduleIndex: number, field: 'day' | 'time', value: string) => {
        setSections(prev => prev.map((s, i) => {
            if (i !== sectionIndex) return s;
            const newSchedule = [...s.schedule];
            newSchedule[scheduleIndex] = { ...newSchedule[scheduleIndex], [field]: value };
            return { ...s, schedule: newSchedule };
        }));
    };

    const addScheduleSlot = (sectionIndex: number) => {
        setSections(prev => prev.map((s, i) => {
            if (i !== sectionIndex) return s;
            return { ...s, schedule: [...s.schedule, { day: 'Monday', time: '9:40 - 10:30' }] };
        }));
    };

    const removeScheduleSlot = (sectionIndex: number, scheduleIndex: number) => {
        setSections(prev => prev.map((s, i) => {
            if (i !== sectionIndex) return s;
            return { ...s, schedule: s.schedule.filter((_, si) => si !== scheduleIndex) };
        }));
    };

    const addSection = () => {
        setSections(prev => [...prev, {
            section: String.fromCharCode(65 + prev.length),
            instructor: '',
            location: '',
            schedule: [{ day: 'Monday', time: '9:40 - 10:30' }]
        }]);
    };

    const removeSection = (index: number) => {
        setSections(prev => prev.filter((_, i) => i !== index));
    };

    const addToList = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
        if (value.trim() && !list.includes(value.trim())) {
            setList([...list, value.trim()]);
            setValue('');
        }
    };

    const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
        setList(list.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!course) return null;

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
                <div className="flex h-14 items-center px-4 gap-4">
                    <Link href="/admin/dashboard">
                        <Button variant="ghost" size="sm" className="gap-2 rounded-xl">
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <Badge variant="outline" className="font-mono">{course.id}</Badge>
                    </div>
                    <div className="ml-auto">
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </header>

            <main className="p-4 sm:p-6 max-w-5xl mx-auto">
                <Tabs defaultValue="basic" className="space-y-6">
                    <TabsList className="bg-secondary/50 p-1 rounded-2xl flex-wrap h-auto">
                        <TabsTrigger value="basic" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <GraduationCap className="w-4 h-4" />
                            Basic Info
                        </TabsTrigger>
                        <TabsTrigger value="credits" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <FileText className="w-4 h-4" />
                            Credits
                        </TabsTrigger>
                        <TabsTrigger value="sections" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <BookOpen className="w-4 h-4" />
                            Sections
                        </TabsTrigger>
                        <TabsTrigger value="requirements" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <CheckSquare className="w-4 h-4" />
                            Requirements
                        </TabsTrigger>
                        <TabsTrigger value="content" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <Tag className="w-4 h-4" />
                            Content
                        </TabsTrigger>
                        <TabsTrigger value="difficulty" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <Brain className="w-4 h-4" />
                            Difficulty
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                            <CardHeader>
                                <CardTitle className="text-lg">Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Title</label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Description</label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                        rows={5}
                                        className="rounded-xl resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Level</label>
                                        <Input
                                            value={formData.level}
                                            onChange={(e) => setFormData(p => ({ ...p, level: e.target.value }))}
                                            placeholder="e.g., Undergraduate, Graduate"
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Major/Department</label>
                                        <Input
                                            value={formData.major}
                                            onChange={(e) => setFormData(p => ({ ...p, major: e.target.value }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Professor</label>
                                        <Input
                                            value={formData.professor}
                                            onChange={(e) => setFormData(p => ({ ...p, professor: e.target.value }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Location</label>
                                        <Input
                                            value={formData.location}
                                            onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                                        <Video className="w-4 h-4" /> Video URL (YouTube)
                                    </label>
                                    <Input
                                        value={formData.video_url}
                                        onChange={(e) => setFormData(p => ({ ...p, video_url: e.target.value }))}
                                        placeholder="https://youtube.com/watch?v=..."
                                        className="rounded-xl"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="credits" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Credit Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">SU Credits</label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={formData.su_credits}
                                            onChange={(e) => setFormData(p => ({ ...p, su_credits: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">ECTS Credits</label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={formData.ects_credits}
                                            onChange={(e) => setFormData(p => ({ ...p, ects_credits: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Legacy Credits</label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={formData.credits}
                                            onChange={(e) => setFormData(p => ({ ...p, credits: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Basic Science</label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={formData.basic_science_credits}
                                            onChange={(e) => setFormData(p => ({ ...p, basic_science_credits: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Engineering</label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={formData.engineering_credits}
                                            onChange={(e) => setFormData(p => ({ ...p, engineering_credits: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Course Format</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Midterm Count</label>
                                        <Input
                                            type="number"
                                            value={formData.midterm_count}
                                            onChange={(e) => setFormData(p => ({ ...p, midterm_count: parseInt(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.has_project}
                                            onChange={(e) => setFormData(p => ({ ...p, has_project: e.target.checked }))}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Has Project</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.has_quizzes}
                                            onChange={(e) => setFormData(p => ({ ...p, has_quizzes: e.target.checked }))}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Has Quizzes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.has_participation}
                                            onChange={(e) => setFormData(p => ({ ...p, has_participation: e.target.checked }))}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Has Participation</span>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="sections" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                    Sections ({sections.length})
                                </CardTitle>
                                <Button onClick={addSection} size="sm" className="rounded-xl gap-2">
                                    <Plus className="w-4 h-4" />
                                    Add Section
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {sections.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No sections yet</p>
                                ) : (
                                    sections.map((section, sIdx) => (
                                        <div key={sIdx} className="p-4 rounded-xl border bg-secondary/20 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono rounded-lg">
                                                        Section {section.section}
                                                    </Badge>
                                                    <Input
                                                        value={section.section}
                                                        onChange={(e) => updateSection(sIdx, 'section', e.target.value)}
                                                        className="w-20 h-8 rounded-lg text-sm"
                                                        placeholder="A"
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeSection(sIdx)}
                                                    className="text-destructive hover:text-destructive rounded-xl"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                                                        <User className="w-3 h-3" /> Instructor
                                                    </label>
                                                    <Input
                                                        value={section.instructor}
                                                        onChange={(e) => updateSection(sIdx, 'instructor', e.target.value)}
                                                        placeholder="Instructor name"
                                                        className="rounded-lg h-9 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> Location
                                                    </label>
                                                    <Input
                                                        value={section.location}
                                                        onChange={(e) => updateSection(sIdx, 'location', e.target.value)}
                                                        placeholder="Room/Building"
                                                        className="rounded-lg h-9 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <Separator />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-medium flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> Schedule
                                                    </label>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addScheduleSlot(sIdx)}
                                                        className="h-7 text-xs rounded-lg gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Add Time
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {section.schedule.map((slot, slotIdx) => (
                                                        <div key={slotIdx} className="flex items-center gap-2">
                                                            <select
                                                                value={slot.day}
                                                                onChange={(e) => updateSectionSchedule(sIdx, slotIdx, 'day', e.target.value)}
                                                                className="h-9 px-3 rounded-lg border bg-background text-sm flex-1"
                                                            >
                                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                                                                    <option key={d} value={d}>{d}</option>
                                                                ))}
                                                            </select>
                                                            <Input
                                                                value={slot.time}
                                                                onChange={(e) => updateSectionSchedule(sIdx, slotIdx, 'time', e.target.value)}
                                                                placeholder="9:40 - 10:30"
                                                                className="rounded-lg h-9 text-sm flex-1"
                                                            />
                                                            {section.schedule.length > 1 && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => removeScheduleSlot(sIdx, slotIdx)}
                                                                    className="h-9 w-9 text-destructive hover:text-destructive rounded-lg"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="requirements" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Prerequisites</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={newPrereq}
                                        onChange={(e) => setNewPrereq(e.target.value.toUpperCase())}
                                        placeholder="Course ID (e.g., CS 201)"
                                        className="rounded-xl"
                                        onKeyDown={(e) => e.key === 'Enter' && addToList(prerequisites, setPrerequisites, newPrereq, setNewPrereq)}
                                    />
                                    <Button onClick={() => addToList(prerequisites, setPrerequisites, newPrereq, setNewPrereq)} className="rounded-xl">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {prerequisites.map((p, i) => (
                                        <Badge key={i} variant="secondary" className="rounded-lg gap-1 pr-1">
                                            {p}
                                            <button onClick={() => removeFromList(prerequisites, setPrerequisites, i)} className="ml-1 hover:text-destructive">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Corequisites (Recitations)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={newCoreq}
                                        onChange={(e) => setNewCoreq(e.target.value.toUpperCase())}
                                        placeholder="Course ID"
                                        className="rounded-xl"
                                        onKeyDown={(e) => e.key === 'Enter' && addToList(corequisites, setCorequisites, newCoreq, setNewCoreq)}
                                    />
                                    <Button onClick={() => addToList(corequisites, setCorequisites, newCoreq, setNewCoreq)} className="rounded-xl">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {corequisites.map((c, i) => (
                                        <Badge key={i} variant="outline" className="rounded-lg gap-1 pr-1">
                                            {c}
                                            <button onClick={() => removeFromList(corequisites, setCorequisites, i)} className="ml-1 hover:text-destructive">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-sky-500 to-cyan-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Tags</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        placeholder="Add a tag"
                                        className="rounded-xl"
                                        onKeyDown={(e) => e.key === 'Enter' && addToList(tags, setTags, newTag, setNewTag)}
                                    />
                                    <Button onClick={() => addToList(tags, setTags, newTag, setNewTag)} className="rounded-xl">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((t, i) => (
                                        <Badge key={i} className="rounded-lg gap-1 pr-1">
                                            {t}
                                            <button onClick={() => removeFromList(tags, setTags, i)} className="ml-1 hover:text-destructive">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Key Topics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={newTopic}
                                        onChange={(e) => setNewTopic(e.target.value)}
                                        placeholder="Add a key topic"
                                        className="rounded-xl"
                                        onKeyDown={(e) => e.key === 'Enter' && addToList(keyTopics, setKeyTopics, newTopic, setNewTopic)}
                                    />
                                    <Button onClick={() => addToList(keyTopics, setKeyTopics, newTopic, setNewTopic)} className="rounded-xl">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {keyTopics.map((t, i) => (
                                        <Badge key={i} variant="secondary" className="rounded-lg gap-1 pr-1">
                                            {t}
                                            <button onClick={() => removeFromList(keyTopics, setKeyTopics, i)} className="ml-1 hover:text-destructive">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Main Textbooks</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={newTextbook}
                                        onChange={(e) => setNewTextbook(e.target.value)}
                                        placeholder="Add a textbook"
                                        className="rounded-xl"
                                        onKeyDown={(e) => e.key === 'Enter' && addToList(mainTextbooks, setMainTextbooks, newTextbook, setNewTextbook)}
                                    />
                                    <Button onClick={() => addToList(mainTextbooks, setMainTextbooks, newTextbook, setNewTextbook)} className="rounded-xl">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {mainTextbooks.map((t, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                                            <span className="flex-1 text-sm">{t}</span>
                                            <button onClick={() => removeFromList(mainTextbooks, setMainTextbooks, i)} className="hover:text-destructive">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-slate-500 to-gray-500" />
                            <CardHeader>
                                <CardTitle className="text-lg">Syllabus Text (JSON)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={syllabusText}
                                    onChange={(e) => setSyllabusText(e.target.value)}
                                    rows={10}
                                    className="rounded-xl font-mono text-xs resize-none"
                                    placeholder='{"course_objective": "...", "course_learning_outcomes": [...], "assessment_percent": {...}}'
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="difficulty" className="space-y-6">
                        <Card className="rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-primary" />
                                    Difficulty Ratings (1-5)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Overall Score</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={difficulty.weighted_difficulty_score || ''}
                                            onChange={(e) => setDifficulty(d => ({ ...d, weighted_difficulty_score: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Conceptual Depth</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={difficulty.conceptual_depth || ''}
                                            onChange={(e) => setDifficulty(d => ({ ...d, conceptual_depth: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Reading Intensity</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={difficulty.reading_intensity || ''}
                                            onChange={(e) => setDifficulty(d => ({ ...d, reading_intensity: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Project Complexity</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={difficulty.project_complexity || ''}
                                            onChange={(e) => setDifficulty(d => ({ ...d, project_complexity: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Assessments</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={difficulty.assessments || ''}
                                            onChange={(e) => setDifficulty(d => ({ ...d, assessments: parseFloat(e.target.value) || 0 }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
