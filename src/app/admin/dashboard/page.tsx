'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Search, LogOut, Loader2, BookOpen, MessageSquare, 
    CheckCircle2, XCircle, Clock, Star, Trash2, Shield,
    ChevronLeft, ChevronRight, FileText, ExternalLink,
    Brain, TrendingUp, ThumbsUp, ThumbsDown
} from "lucide-react";
import { toast } from "sonner";

interface Course {
    id: string;
    title: string;
    professor: string;
    location: string;
    schedule: string;
    sections: string;
    su_credits: number;
    level: string;
    major: string;
}

interface Review {
    id: number;
    course_id: string;
    course_title: string;
    author_name: string;
    content: string;
    overall_rating: number | null;
    difficulty_rating: number | null;
    workload_rating: number | null;
    usefulness_rating: number | null;
    grade_received: string | null;
    semester_taken: string | null;
    would_recommend: number | null;
    status: string;
    created_at: string;
}

interface Note {
    id: number;
    course_id: string;
    course_title: string;
    author_name: string;
    title: string;
    description: string | null;
    document_url: string;
    document_type: string;
    source: string;
    semester: string | null;
    note_type: string;
    status: string;
    created_at: string;
}

export default function AdminDashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [reviewFilter, setReviewFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [noteFilter, setNoteFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [coursesTotal, setCoursesTotal] = useState(0);
    const [coursesPage, setCoursesPage] = useState(0);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const router = useRouter();

    const COURSES_PER_PAGE = 20;

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
        }).catch(() => {
            router.push('/admin');
        }).finally(() => setLoading(false));
    }, [router]);

    const fetchCourses = useCallback(async () => {
        if (!token) return;
        setLoadingCourses(true);
        try {
            const res = await fetch(
                `/api/admin/courses?search=${encodeURIComponent(searchQuery)}&limit=${COURSES_PER_PAGE}&offset=${coursesPage * COURSES_PER_PAGE}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            setCourses(data.courses || []);
            setCoursesTotal(data.total || 0);
        } catch {
            toast.error('Failed to fetch courses');
        } finally {
            setLoadingCourses(false);
        }
    }, [token, searchQuery, coursesPage]);

    const fetchReviews = useCallback(async () => {
        if (!token) return;
        setLoadingReviews(true);
        try {
            const res = await fetch(`/api/admin/reviews?status=${reviewFilter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setReviews(data.reviews || []);
        } catch {
            toast.error('Failed to fetch reviews');
        } finally {
            setLoadingReviews(false);
        }
    }, [token, reviewFilter]);

    const fetchNotes = useCallback(async () => {
        if (!token) return;
        setLoadingNotes(true);
        try {
            const res = await fetch(`/api/admin/notes?status=${noteFilter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setNotes(data.notes || []);
        } catch {
            toast.error('Failed to fetch notes');
        } finally {
            setLoadingNotes(false);
        }
    }, [token, noteFilter]);

    useEffect(() => {
        if (token) fetchCourses();
    }, [token, fetchCourses]);

    useEffect(() => {
        if (token) fetchReviews();
    }, [token, fetchReviews]);

    useEffect(() => {
        if (token) fetchNotes();
    }, [token, fetchNotes]);

    const handleReviewAction = async (id: number, status: 'approved' | 'rejected') => {
        try {
            const res = await fetch('/api/admin/reviews', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, status })
            });

            if (res.ok) {
                toast.success(`Review ${status}`);
                fetchReviews();
            }
        } catch {
            toast.error('Action failed');
        }
    };

    const handleDeleteReview = async (id: number) => {
        if (!confirm('Delete this review permanently?')) return;
        
        try {
            const res = await fetch(`/api/admin/reviews?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success('Review deleted');
                fetchReviews();
            }
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleNoteAction = async (id: number, status: 'approved' | 'rejected') => {
        try {
            const res = await fetch('/api/admin/notes', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, status })
            });

            if (res.ok) {
                toast.success(`Note ${status}`);
                fetchNotes();
            }
        } catch {
            toast.error('Action failed');
        }
    };

    const handleDeleteNote = async (id: number) => {
        if (!confirm('Delete this note permanently?')) return;
        
        try {
            const res = await fetch(`/api/admin/notes?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success('Note deleted');
                fetchNotes();
            }
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        router.push('/admin');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const totalPages = Math.ceil(coursesTotal / COURSES_PER_PAGE);
    const pendingReviewCount = reviewFilter === 'pending' ? reviews.length : 0;
    const pendingNoteCount = noteFilter === 'pending' ? notes.length : 0;

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
                <div className="flex h-14 items-center px-4 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold">Admin Dashboard</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="rounded-xl">
                                View Site
                            </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl gap-2 text-destructive hover:text-destructive">
                            <LogOut className="w-4 h-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            <main className="p-4 sm:p-6 max-w-7xl mx-auto">
                <Tabs defaultValue="reviews" className="space-y-6">
                    <TabsList className="bg-secondary/50 p-1 rounded-2xl">
                        <TabsTrigger value="reviews" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <MessageSquare className="w-4 h-4" />
                            Reviews
                            {pendingReviewCount > 0 && (
                                <Badge className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5">
                                    {pendingReviewCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <FileText className="w-4 h-4" />
                            Notes
                            {pendingNoteCount > 0 && (
                                <Badge className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5">
                                    {pendingNoteCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="courses" className="rounded-xl gap-2 data-[state=active]:bg-background">
                            <BookOpen className="w-4 h-4" />
                            Courses
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="reviews" className="space-y-4">
                        <div className="flex gap-2">
                            {(['pending', 'approved', 'rejected'] as const).map((status) => (
                                <Button
                                    key={status}
                                    variant={reviewFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setReviewFilter(status)}
                                    className="rounded-xl capitalize gap-2"
                                >
                                    {status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                                    {status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                    {status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                                    {status}
                                </Button>
                            ))}
                        </div>

                        {loadingReviews ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : reviews.length === 0 ? (
                            <Card className="rounded-2xl">
                                <CardContent className="py-12 text-center">
                                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-muted-foreground">No {reviewFilter} reviews</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {reviews.map((review) => (
                                    <Card key={review.id} className="rounded-2xl overflow-hidden">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="font-semibold">{review.author_name}</span>
                                                        {review.semester_taken && (
                                                            <Badge variant="secondary" className="rounded text-[10px]">
                                                                {review.semester_taken}
                                                            </Badge>
                                                        )}
                                                        {review.grade_received && (
                                                            <Badge variant="outline" className="rounded text-[10px]">
                                                                Grade: {review.grade_received}
                                                            </Badge>
                                                        )}
                                                        {review.would_recommend !== null && (
                                                            <Badge 
                                                                variant={review.would_recommend ? "default" : "destructive"} 
                                                                className="rounded text-[10px]"
                                                            >
                                                                {review.would_recommend ? (
                                                                    <><ThumbsUp className="w-2.5 h-2.5 mr-1" /> Recommends</>
                                                                ) : (
                                                                    <><ThumbsDown className="w-2.5 h-2.5 mr-1" /> Not Recommended</>
                                                                )}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(review.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    
                                                    <Link href={`/courses/${encodeURIComponent(review.course_id)}`} className="text-xs text-primary hover:underline mb-2 block">
                                                        {review.course_id} - {review.course_title}
                                                    </Link>

                                                    {(review.overall_rating || review.difficulty_rating || review.workload_rating || review.usefulness_rating) && (
                                                        <div className="flex flex-wrap gap-3 mb-2 text-xs">
                                                            {review.overall_rating && (
                                                                <div className="flex items-center gap-1">
                                                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                                    <span>{review.overall_rating}/5</span>
                                                                </div>
                                                            )}
                                                            {review.difficulty_rating && (
                                                                <div className="flex items-center gap-1">
                                                                    <Brain className="w-3 h-3 text-primary" />
                                                                    <span>Diff: {review.difficulty_rating}/5</span>
                                                                </div>
                                                            )}
                                                            {review.workload_rating && (
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 text-primary" />
                                                                    <span>Work: {review.workload_rating}/5</span>
                                                                </div>
                                                            )}
                                                            {review.usefulness_rating && (
                                                                <div className="flex items-center gap-1">
                                                                    <TrendingUp className="w-3 h-3 text-primary" />
                                                                    <span>Use: {review.usefulness_rating}/5</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.content}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {reviewFilter === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleReviewAction(review.id, 'approved')}
                                                                className="rounded-xl gap-1 bg-accent hover:bg-accent/90"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleReviewAction(review.id, 'rejected')}
                                                                className="rounded-xl gap-1"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteReview(review.id)}
                                                        className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4">
                        <div className="flex gap-2">
                            {(['pending', 'approved', 'rejected'] as const).map((status) => (
                                <Button
                                    key={status}
                                    variant={noteFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setNoteFilter(status)}
                                    className="rounded-xl capitalize gap-2"
                                >
                                    {status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                                    {status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                    {status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                                    {status}
                                </Button>
                            ))}
                        </div>

                        {loadingNotes ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : notes.length === 0 ? (
                            <Card className="rounded-2xl">
                                <CardContent className="py-12 text-center">
                                    <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-muted-foreground">No {noteFilter} notes</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {notes.map((note) => (
                                    <Card key={note.id} className="rounded-2xl overflow-hidden">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="font-semibold">{note.author_name}</span>
                                                        <Badge variant="secondary" className="rounded text-[10px] capitalize">
                                                            {note.note_type.replace(/_/g, ' ')}
                                                        </Badge>
                                                        <Badge variant="outline" className="rounded text-[10px] uppercase">
                                                            {note.document_type}
                                                        </Badge>
                                                        <Badge variant="outline" className="rounded text-[10px] capitalize">
                                                            {note.source.replace(/_/g, ' ')}
                                                        </Badge>
                                                        {note.semester && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {note.semester}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(note.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    
                                                    <Link href={`/courses/${encodeURIComponent(note.course_id)}`} className="text-xs text-primary hover:underline mb-2 block">
                                                        {note.course_id} - {note.course_title}
                                                    </Link>

                                                    <h4 className="font-medium mb-1">{note.title}</h4>
                                                    {note.description && (
                                                        <p className="text-sm text-muted-foreground mb-2">{note.description}</p>
                                                    )}
                                                    
                                                    <a 
                                                        href={note.document_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        View Document
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {noteFilter === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleNoteAction(note.id, 'approved')}
                                                                className="rounded-xl gap-1 bg-accent hover:bg-accent/90"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleNoteAction(note.id, 'rejected')}
                                                                className="rounded-xl gap-1"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteNote(note.id)}
                                                        className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="courses" className="space-y-4">
                        <div className="flex gap-4 items-center">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search courses..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCoursesPage(0);
                                    }}
                                    className="pl-10 rounded-xl"
                                />
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {coursesTotal} courses
                            </span>
                        </div>

                        {loadingCourses ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <Card className="rounded-2xl overflow-hidden">
                                    <ScrollArea className="h-[500px]">
                                        <div className="divide-y">
                                            {courses.map((course) => (
                                                <Link
                                                    key={course.id}
                                                    href={`/admin/courses/${encodeURIComponent(course.id)}`}
                                                    className="block p-4 hover:bg-secondary/30 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className="font-mono text-xs rounded-lg">
                                                                    {course.id}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {course.su_credits} credits
                                                                </span>
                                                            </div>
                                                            <h3 className="font-medium truncate">{course.title}</h3>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {course.professor || 'No professor'} • {course.major}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </Card>

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={coursesPage === 0}
                                            onClick={() => setCoursesPage(p => p - 1)}
                                            className="rounded-xl"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="text-sm text-muted-foreground px-4">
                                            Page {coursesPage + 1} of {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={coursesPage >= totalPages - 1}
                                            onClick={() => setCoursesPage(p => p + 1)}
                                            className="rounded-xl"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
