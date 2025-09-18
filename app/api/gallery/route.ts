import { NextRequest, NextResponse } from 'next/server';
import { galleryService } from '@/lib/gallery';
import { isAuthenticated } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '12');

  try {
    if (action === 'search' && query) {
      const projects = await galleryService.searchProjects(query, limit);
      return NextResponse.json({ projects });
    }

    // Default to featured projects
    const projects = await galleryService.getFeaturedProjects(limit);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Gallery API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await isAuthenticated();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { project } = await req.json();

    if (!project || !project.id || !project.name) {
      return NextResponse.json(
        { error: 'Invalid project data' },
        { status: 400 }
      );
    }

    const result = await galleryService.addToGallery({
      id: project.id,
      title: project.name,
      description: project.prompt || '',
      author: user.name || user.email || 'Anonymous',
      emoji: project.emoji || '🚀',
      html: project.html || '',
      tags: project.tags || [],
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        galleryUrl: result.url,
      });
    }

    return NextResponse.json(
      { error: result.error || 'Failed to add to gallery' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Gallery POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add project to gallery' },
      { status: 500 }
    );
  }
}