'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
    MessageSquare, Star, Send, Loader2, User, ThumbsUp, ThumbsDown,
    BookOpen, Brain, Clock, TrendingUp, FileText, ExternalLink,
    Droplet, FileSpreadsheet, GraduationCap, Eye, X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getEmbedUrl(url: string, source: string): string | null {
    try {
        if (source === 'google_drive') {
            const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch) {
                return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
            }
            const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (openMatch) {
                return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
            }
        }
        
        if (source === 'dropbox') {
            let embedUrl = url.replace('www.dropbox.com', 'www.dropbox.com');
            if (embedUrl.includes('?')) {
                embedUrl = embedUrl.replace(/dl=0/, 'raw=1').replace(/dl=1/, 'raw=1');
                if (!embedUrl.includes('raw=1')) {
                    embedUrl += '&raw=1';
                }
            } else {
                embedUrl += '?raw=1';
            }
            return embedUrl;
        }
        
        return null;
    } catch {
        return null;
    }
}

interface Review {
    id: number;
    author_name: string;
    content: string;
    overall_rating: number | null;
    difficulty_rating: number | null;
    workload_rating: number | null;
    usefulness_rating: number | null;
    grade_received: string | null;
    semester_taken: string | null;
    would_recommend: number | null;
    created_at: string;
}

interface Note {
    id: number;
    author_name: string;
    title: string;
    description: string | null;
    document_url: string;
    document_type: string;
    source: string;
    semester: string | null;
    note_type: string;
    created_at: string;
}

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'W', 'P', 'NP'];
const SEMESTERS = ['Fall 2025', 'Spring 2025', 'Fall 2024', 'Spring 2024', 'Fall 2023', 'Spring 2023', 'Earlier'];
const NOTE_TYPES = [
    { value: 'lecture_notes', label: 'Lecture Notes' },
    { value: 'study_guide', label: 'Study Guide' },
    { value: 'cheat_sheet', label: 'Cheat Sheet' },
    { value: 'past_exam', label: 'Past Exam' },
    { value: 'summary', label: 'Summary' },
    { value: 'other', label: 'Other' },
];
const DOC_TYPES = [
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'Word Doc' },
    { value: 'docx', label: 'Word Doc' },
    { value: 'slides', label: 'Slides' },
    { value: 'other', label: 'Other' },
];

function RatingStars({ 
    value, 
    onChange, 
    label, 
    icon: Icon,
    readOnly = false 
}: { 
    value: number; 
    onChange?: (v: number) => void; 
    label: string;
    icon: React.ElementType;
    readOnly?: boolean;
}) {
    const [hover, setHover] = useState(0);
    
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="w-4 h-4 text-primary" />
                {label}
            </div>
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onChange?.(star === value ? 0 : star)}
                        onMouseEnter={() => !readOnly && setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className={cn(
                            "p-0.5 transition-transform",
                            !readOnly && "hover:scale-110 cursor-pointer"
                        )}
                    >
                        <Star
                            className={cn(
                                "w-5 h-5 transition-colors",
                                (hover || value) >= star
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-muted-foreground/30"
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

function SourceIcon({ source }: { source: string }) {
    if (source === 'dropbox') return <Droplet className="w-4 h-4 text-blue-500" />;
    if (source === 'google_drive') return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
}

export default function CourseReviews({ courseId }: { courseId: string }) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('reviews');
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [previewNote, setPreviewNote] = useState<Note | null>(null);

    const [reviewForm, setReviewForm] = useState({
        name: '',
        content: '',
        overallRating: 0,
        difficultyRating: 0,
        workloadRating: 0,
        usefulnessRating: 0,
        gradeReceived: '',
        semesterTaken: '',
        wouldRecommend: null as boolean | null,
    });

    const [noteForm, setNoteForm] = useState({
        name: '',
        title: '',
        description: '',
        documentUrl: '',
        documentType: 'pdf',
        semester: '',
        noteType: 'lecture_notes',
    });

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await fetch(`/api/reviews?courseId=${encodeURIComponent(courseId)}`);
                const data = await res.json();
                setReviews(data.reviews || []);
            } catch {
                console.error('Failed to fetch reviews');
            } finally {
                setLoadingReviews(false);
            }
        };

        const fetchNotes = async () => {
            try {
                const res = await fetch(`/api/notes?courseId=${encodeURIComponent(courseId)}`);
                const data = await res.json();
                setNotes(data.notes || []);
            } catch {
                console.error('Failed to fetch notes');
            } finally {
                setLoadingNotes(false);
            }
        };

        fetchReviews();
        fetchNotes();
    }, [courseId]);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewForm.name.trim() || !reviewForm.content.trim()) {
            toast.error('Please fill in your name and review');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId,
                    authorName: reviewForm.name.trim(),
                    content: reviewForm.content.trim(),
                    overallRating: reviewForm.overallRating || null,
                    difficultyRating: reviewForm.difficultyRating || null,
                    workloadRating: reviewForm.workloadRating || null,
                    usefulnessRating: reviewForm.usefulnessRating || null,
                    gradeReceived: reviewForm.gradeReceived || null,
                    semesterTaken: reviewForm.semesterTaken || null,
                    wouldRecommend: reviewForm.wouldRecommend,
                }),
            });

            if (res.ok) {
                toast.success('Review submitted!', {
                    description: 'It will appear after admin approval.',
                });
                setReviewForm({
                    name: '',
                    content: '',
                    overallRating: 0,
                    difficultyRating: 0,
                    workloadRating: 0,
                    usefulnessRating: 0,
                    gradeReceived: '',
                    semesterTaken: '',
                    wouldRecommend: null,
                });
                setShowReviewForm(false);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to submit');
            }
        } catch {
            toast.error('Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteForm.name.trim() || !noteForm.title.trim() || !noteForm.documentUrl.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId,
                    authorName: noteForm.name.trim(),
                    title: noteForm.title.trim(),
                    description: noteForm.description.trim() || null,
                    documentUrl: noteForm.documentUrl.trim(),
                    documentType: noteForm.documentType,
                    semester: noteForm.semester || null,
                    noteType: noteForm.noteType,
                }),
            });

            if (res.ok) {
                toast.success('Note submitted!', {
                    description: 'It will appear after admin approval.',
                });
                setNoteForm({
                    name: '',
                    title: '',
                    description: '',
                    documentUrl: '',
                    documentType: 'pdf',
                    semester: '',
                    noteType: 'lecture_notes',
                });
                setShowNoteForm(false);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to submit');
            }
        } catch {
            toast.error('Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const avgRating = (field: keyof Review) => {
        const vals = reviews.map(r => r[field]).filter((v): v is number => typeof v === 'number' && v > 0);
        if (vals.length === 0) return null;
        return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    };

    return (
        <Card className="shadow-lg rounded-2xl overflow-hidden mt-6">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    Student Feedback
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 rounded-xl mb-4">
                        <TabsTrigger value="reviews" className="rounded-lg gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Reviews {reviews.length > 0 && `(${reviews.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="rounded-lg gap-2">
                            <FileText className="w-4 h-4" />
                            Notes {notes.length > 0 && `(${notes.length})`}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="reviews" className="space-y-4">
                        {reviews.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-secondary/30">
                                {[
                                    { label: 'Overall', value: avgRating('overall_rating'), icon: Star },
                                    { label: 'Difficulty', value: avgRating('difficulty_rating'), icon: Brain },
                                    { label: 'Workload', value: avgRating('workload_rating'), icon: Clock },
                                    { label: 'Usefulness', value: avgRating('usefulness_rating'), icon: TrendingUp },
                                ].map(({ label, value, icon: Icon }) => value && (
                                    <div key={label} className="text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Icon className="w-4 h-4 text-primary" />
                                            <span className="text-xs text-muted-foreground">{label}</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-lg font-bold">{value}</span>
                                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!showReviewForm && (
                            <Button 
                                onClick={() => setShowReviewForm(true)} 
                                className="w-full rounded-xl gap-2"
                                variant="outline"
                            >
                                <Send className="w-4 h-4" />
                                Write a Review
                            </Button>
                        )}

                        {showReviewForm && (
                            <form onSubmit={handleSubmitReview} className="p-4 rounded-xl bg-secondary/30 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Your Name *</label>
                                        <Input
                                            value={reviewForm.name}
                                            onChange={(e) => setReviewForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="Enter your name"
                                            maxLength={100}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Semester Taken</label>
                                        <Select 
                                            value={reviewForm.semesterTaken} 
                                            onValueChange={(v) => setReviewForm(f => ({ ...f, semesterTaken: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select semester" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SEMESTERS.map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <RatingStars
                                        value={reviewForm.overallRating}
                                        onChange={(v) => setReviewForm(f => ({ ...f, overallRating: v }))}
                                        label="Overall"
                                        icon={Star}
                                    />
                                    <RatingStars
                                        value={reviewForm.difficultyRating}
                                        onChange={(v) => setReviewForm(f => ({ ...f, difficultyRating: v }))}
                                        label="Difficulty"
                                        icon={Brain}
                                    />
                                    <RatingStars
                                        value={reviewForm.workloadRating}
                                        onChange={(v) => setReviewForm(f => ({ ...f, workloadRating: v }))}
                                        label="Workload"
                                        icon={Clock}
                                    />
                                    <RatingStars
                                        value={reviewForm.usefulnessRating}
                                        onChange={(v) => setReviewForm(f => ({ ...f, usefulnessRating: v }))}
                                        label="Usefulness"
                                        icon={TrendingUp}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Grade Received</label>
                                        <Select 
                                            value={reviewForm.gradeReceived} 
                                            onValueChange={(v) => setReviewForm(f => ({ ...f, gradeReceived: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {GRADES.map(g => (
                                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Would Recommend?</label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={reviewForm.wouldRecommend === true ? "default" : "outline"}
                                                className="flex-1 rounded-xl gap-2"
                                                onClick={() => setReviewForm(f => ({ ...f, wouldRecommend: true }))}
                                            >
                                                <ThumbsUp className="w-4 h-4" />
                                                Yes
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={reviewForm.wouldRecommend === false ? "default" : "outline"}
                                                className="flex-1 rounded-xl gap-2"
                                                onClick={() => setReviewForm(f => ({ ...f, wouldRecommend: false }))}
                                            >
                                                <ThumbsDown className="w-4 h-4" />
                                                No
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">Your Review *</label>
                                    <Textarea
                                        value={reviewForm.content}
                                        onChange={(e) => setReviewForm(f => ({ ...f, content: e.target.value }))}
                                        placeholder="Share your experience with this course... What did you like? What could be improved? Tips for future students?"
                                        rows={5}
                                        maxLength={3000}
                                        className="rounded-xl resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1 text-right">
                                        {reviewForm.content.length}/3000
                                    </p>
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowReviewForm(false)}
                                        className="rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting || !reviewForm.name.trim() || !reviewForm.content.trim()}
                                        className="rounded-xl gap-2"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Submit Review
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    Reviews are published after admin approval
                                </p>
                            </form>
                        )}

                        {loadingReviews ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : reviews.length === 0 ? (
                            <div className="text-center py-8">
                                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No reviews yet</p>
                                <p className="text-sm text-muted-foreground">Be the first to share your experience!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className="p-4 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <span className="font-medium text-sm">{review.author_name}</span>
                                                    {review.semester_taken && (
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            • {review.semester_taken}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {review.grade_received && (
                                                    <Badge variant="secondary" className="rounded-lg text-xs">
                                                        Grade: {review.grade_received}
                                                    </Badge>
                                                )}
                                                {review.would_recommend !== null && (
                                                    <Badge 
                                                        variant={review.would_recommend ? "default" : "destructive"} 
                                                        className="rounded-lg text-xs"
                                                    >
                                                        {review.would_recommend ? (
                                                            <><ThumbsUp className="w-3 h-3 mr-1" /> Recommends</>
                                                        ) : (
                                                            <><ThumbsDown className="w-3 h-3 mr-1" /> Not Recommended</>
                                                        )}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {(review.overall_rating || review.difficulty_rating || review.workload_rating || review.usefulness_rating) && (
                                            <div className="flex flex-wrap gap-4 mb-3 text-xs">
                                                {review.overall_rating && (
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                        <span>{review.overall_rating}/5 Overall</span>
                                                    </div>
                                                )}
                                                {review.difficulty_rating && (
                                                    <div className="flex items-center gap-1">
                                                        <Brain className="w-3.5 h-3.5 text-primary" />
                                                        <span>{review.difficulty_rating}/5 Difficulty</span>
                                                    </div>
                                                )}
                                                {review.workload_rating && (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-primary" />
                                                        <span>{review.workload_rating}/5 Workload</span>
                                                    </div>
                                                )}
                                                {review.usefulness_rating && (
                                                    <div className="flex items-center gap-1">
                                                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                                                        <span>{review.usefulness_rating}/5 Usefulness</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                            {review.content}
                                        </p>
                                        <p className="text-xs text-muted-foreground/60 mt-2">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4">
                        {!showNoteForm && (
                            <Button 
                                onClick={() => setShowNoteForm(true)} 
                                className="w-full rounded-xl gap-2"
                                variant="outline"
                            >
                                <BookOpen className="w-4 h-4" />
                                Share Notes
                            </Button>
                        )}

                        {showNoteForm && (
                            <form onSubmit={handleSubmitNote} className="p-4 rounded-xl bg-secondary/30 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Your Name *</label>
                                        <Input
                                            value={noteForm.name}
                                            onChange={(e) => setNoteForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="Enter your name"
                                            maxLength={100}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Semester</label>
                                        <Select 
                                            value={noteForm.semester} 
                                            onValueChange={(v) => setNoteForm(f => ({ ...f, semester: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select semester" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SEMESTERS.map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">Note Title *</label>
                                    <Input
                                        value={noteForm.title}
                                        onChange={(e) => setNoteForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g., Week 1-5 Lecture Notes, Midterm Study Guide"
                                        maxLength={200}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Note Type</label>
                                        <Select 
                                            value={noteForm.noteType} 
                                            onValueChange={(v) => setNoteForm(f => ({ ...f, noteType: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {NOTE_TYPES.map(t => (
                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Document Type</label>
                                        <Select 
                                            value={noteForm.documentType} 
                                            onValueChange={(v) => setNoteForm(f => ({ ...f, documentType: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DOC_TYPES.map(t => (
                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">Document Link *</label>
                                    <Input
                                        value={noteForm.documentUrl}
                                        onChange={(e) => setNoteForm(f => ({ ...f, documentUrl: e.target.value }))}
                                        placeholder="Paste Google Drive or Dropbox link"
                                        className="rounded-xl"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Supported: Google Drive, Dropbox (with preview support)
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">Description</label>
                                    <Textarea
                                        value={noteForm.description}
                                        onChange={(e) => setNoteForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Brief description of what's included..."
                                        rows={3}
                                        maxLength={1000}
                                        className="rounded-xl resize-none"
                                    />
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowNoteForm(false)}
                                        className="rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting || !noteForm.name.trim() || !noteForm.title.trim() || !noteForm.documentUrl.trim()}
                                        className="rounded-xl gap-2"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Submit Note
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    Notes are published after admin approval
                                </p>
                            </form>
                        )}

                        {loadingNotes ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : notes.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No notes shared yet</p>
                                <p className="text-sm text-muted-foreground">Be the first to help your classmates!</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {notes.map((note) => {
                                    const embedUrl = getEmbedUrl(note.document_url, note.source);
                                    const canPreview = embedUrl && (note.source === 'google_drive' || note.source === 'dropbox');
                                    
                                    return (
                                        <div
                                            key={note.id}
                                            className="p-4 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <SourceIcon source={note.source} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm truncate">
                                                            {note.title}
                                                        </span>
                                                    </div>
                                                    {note.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                            {note.description}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="secondary" className="rounded text-[10px]">
                                                            {NOTE_TYPES.find(t => t.value === note.note_type)?.label || note.note_type}
                                                        </Badge>
                                                        <Badge variant="outline" className="rounded text-[10px]">
                                                            {DOC_TYPES.find(t => t.value === note.document_type)?.label || note.document_type}
                                                        </Badge>
                                                        {note.semester && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {note.semester}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">
                                                            by {note.author_name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {canPreview && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setPreviewNote(note)}
                                                            className="rounded-lg gap-1.5 h-8"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            Preview
                                                        </Button>
                                                    )}
                                                    <a
                                                        href={note.document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="rounded-lg gap-1.5 h-8"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            Open
                                                        </Button>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <Dialog open={!!previewNote} onOpenChange={(open) => !open && setPreviewNote(null)}>
                    <DialogContent className="max-w-4xl h-[80vh] p-0 rounded-2xl overflow-hidden">
                        <DialogHeader className="p-4 pb-0">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="flex items-center gap-2">
                                    {previewNote && <SourceIcon source={previewNote.source} />}
                                    {previewNote?.title}
                                </DialogTitle>
                                <div className="flex items-center gap-2">
                                    {previewNote && (
                                        <a
                                            href={previewNote.document_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Open in {previewNote.source === 'google_drive' ? 'Drive' : 'Dropbox'}
                                            </Button>
                                        </a>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setPreviewNote(null)}
                                        className="rounded-lg"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            {previewNote?.description && (
                                <p className="text-sm text-muted-foreground mt-1">{previewNote.description}</p>
                            )}
                        </DialogHeader>
                        <div className="flex-1 p-4 pt-2">
                            {previewNote && (
                                <iframe
                                    src={getEmbedUrl(previewNote.document_url, previewNote.source) || ''}
                                    className="w-full h-full rounded-xl border"
                                    title={previewNote.title}
                                    allow="autoplay"
                                />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

