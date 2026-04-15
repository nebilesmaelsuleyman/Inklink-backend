
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorksService } from './modules/works/works.service';
import { UsersService } from './modules/users/users.service';
import { NOTIFICATION_MODEL_NAME, NotificationType } from './modules/notifications/schemas/notification.schema';
import { LIBRARY_MODEL_NAME } from './modules/library/schemas/library.schema';
import { getModelToken } from '@nestjs/mongoose';
import { WORK_MODEL_NAME } from './modules/works/schema/work.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const worksService = app.get(WorksService);
  const usersService = app.get(UsersService);
  const workModel = app.get(getModelToken(WORK_MODEL_NAME));
  const notificationModel = app.get(getModelToken(NOTIFICATION_MODEL_NAME));
  const libraryModel = app.get(getModelToken(LIBRARY_MODEL_NAME));

  console.log('--- SEEDING START ---');

  // 1. Ensure Demo Author exists
  let author: any = await usersService.findByUsername('demo_author');
  if (!author) {
    author = await usersService.create({
      username: 'demo_author',
      password: 'password123',
      role: 'user',
    });
    console.log('Created demo author');
  }

  // 2. Create/Update Books
  const books = [
    {
      title: 'The Whispering Woods',
      summary: 'A group of friends discovers a mysterious forest that seems to speak in riddles. Every tree holds a secret, and every path leads to a forgotten memory.',
      tags: ['Mystery', 'Adventure', 'Fantasy'],
      coverImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2560&auto=format&fit=crop',
    },
    {
      title: 'Beyond the Silver Horizon',
      summary: 'In a world where the ocean meets the stars, a young navigator sets out to find the legendary Starry Isles.',
      tags: ['Sci-Fi', 'Epic', 'Stellar'],
      coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop',
    },
    {
      title: 'The Alchemist\'s Debt',
      summary: 'Elias, a failing alchemist, accidentally creates a potion that turns shadows into gold.',
      tags: ['Fantasy', 'Moral', 'Magic'],
      coverImage: 'https://images.unsplash.com/photo-1532187875460-1e0380bb9158?q=80&w=2670&auto=format&fit=crop',
    }
  ];

  const createdWorks: any[] = [];
  for (const book of books) {
    let work = await workModel.findOne({ title: book.title });
    if (!work) {
      work = await workModel.create({
        ...book,
        authorId: author._id,
        status: 'published',
        childSafe: true
      });
      console.log(`Created book: ${work.title}`);
    } else {
      console.log(`Book already exists: ${work.title}`);
    }
    createdWorks.push(work);
  }

  // 3. Populate Notifications and Bookmarks for ALL users
  const users: any[] = await usersService.findAll();
  console.log(`Processing ${users.length} users...`);

  for (const user of users) {
    const userId = user._id;

    // Create a library for the user if not exists
    await libraryModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, currentlyReading: [], bookmarked: [], readLists: [] } },
      { upsert: true }
    );

    // Give them a notification about the first book
    const firstWork = createdWorks[0];
    const hasNotification = await notificationModel.exists({ userId, title: 'New Story Published!' });
    
    if (!hasNotification) {
      await notificationModel.create({
        userId,
        type: NotificationType.CHAPTER,
        title: 'New Story Published!',
        description: `"${firstWork.title}" is now available for reading!`,
        isRead: false,
        metadata: {
          authorName: 'demo_author',
          authorImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
          bookTitle: firstWork.title,
          bookImage: firstWork.coverImage,
        }
      });
      console.log(`Notification sent to ${user.username}`);
    }

    // Auto-bookmark the first book for them
    await libraryModel.updateOne(
      { userId },
      { $addToSet: { bookmarked: firstWork._id } }
    );
  }

  console.log('--- SEEDING COMPLETED ---');
  await app.close();
}

bootstrap();
