'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Shield, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (token) {
            fetch('/api/admin/auth', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => {
                if (res.ok) {
                    router.push('/admin/dashboard');
                } else {
                    localStorage.removeItem('admin_token');
                    setChecking(false);
                }
            }).catch(() => setChecking(false));
        } else {
            setChecking(false);
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('admin_token', data.token);
                toast.success('Welcome back, Admin!');
                router.push('/admin/dashboard');
            } else {
                toast.error('Invalid credentials');
            }
        } catch {
            toast.error('Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-2xl rounded-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Shield className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl">Admin Access</CardTitle>
                    <p className="text-muted-foreground text-sm mt-2">Enter your credentials to continue</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                autoFocus
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                            />
                        </div>
                        <Button 
                            type="submit" 
                            disabled={loading || !username || !password}
                            className="w-full h-12 rounded-xl text-base font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                'Login'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

