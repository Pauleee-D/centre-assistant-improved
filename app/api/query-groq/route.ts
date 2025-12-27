import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// Lazy initialization to avoid build-time errors
let pinecone: Pinecone;
let googleAI: GoogleGenerativeAI;
let groq: Groq;

function getPinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pinecone;
}

function getGoogleAI() {
  if (!googleAI) {
    googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }
  return googleAI;
}

function getGroq() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });
  }
  return groq;
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 30; // requests per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_QUESTION_LENGTH = 500; // characters

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { question, centre } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Input length validation
    if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `Question must be a string with maximum ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Generate embedding for the question using Google Gemini
    const embeddingModel = getGoogleAI().getGenerativeModel({
      model: 'text-embedding-004'
    });

    const embeddingResult = await embeddingModel.embedContent(question);
    const queryEmbedding = embeddingResult.embedding.values;

    // Query Pinecone
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = getPinecone().index(indexName);

    // Build filter for centre if specified
    const filter = centre && centre !== 'all'
      ? { centre: { $in: [centre, 'general'] } }
      : undefined;

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 50,
      includeMetadata: true,
      filter,
    });

    console.log('All results count:', queryResponse.matches?.length || 0);

    let filteredResults = queryResponse.matches || [];

    if (centre && centre !== 'all') {
      console.log('First 5 result IDs:', filteredResults.slice(0, 5).map((r: any) => r.id));

      // Create normalized version of centre name (remove all non-alphanumeric)
      const normalizedCentre = centre.toLowerCase().replace(/[^a-z0-9]/g, '');

      filteredResults = filteredResults.filter((r: any) => {
        const id = (r.id || '').toLowerCase();
        return id.startsWith(normalizedCentre + '-') ||
               id.startsWith('general-');
      });
      console.log(`Filtered to ${filteredResults.length} results for ${centre} (including general info)`);
    }

    // Take top 3 after filtering
    filteredResults = filteredResults.slice(0, 3);

    if (!filteredResults || filteredResults.length === 0) {
      return NextResponse.json({
        answer: centre && centre !== 'all'
          ? `I don't have specific information about that for ${centre}.`
          : "I don't have specific information about that topic.",
      });
    }

    // Extract relevant content from metadata
    const context = filteredResults
      .map((result: any) => {
        // In Pinecone, the text content is stored in metadata
        return result.metadata?.text || '';
      })
      .filter(Boolean)
      .join('\n\n');

    // Generate response with Groq
    const systemPrompt = `You are a helpful leisure centre assistant. Answer questions about facilities, memberships, classes, and policies in a friendly, professional manner. Use the provided context to give accurate, specific answers.

EXAMPLE INTERACTIONS (follow this style and format):

Q: What are the opening hours?
A: [Centre Name] opening hours:
- Monday to Friday: 5:00 AM - 9:30 PM
- Saturday and Sunday: 7:00 AM - 6:30 PM

Note: Pool areas close 15 minutes before facility closing time.

Q: How much is a membership?
A: [Centre Name] membership options:
- Full Access: $21.05/week (includes gym, pool, classes)
- Concession: $18.00/week
- Gold (Over 50s): $12.70/week
- Joining fee: $99

All memberships include 3 free personal training consultations.

Q: Do you have a pool?
A: Yes, [Centre Name] has:
- Indoor heated pool (year-round)
- Outdoor pool (seasonal)
- Family fun pool with ramp access

Would you like to know the pool hours or temperatures?

Q: What classes do you offer?
A: [Centre Name] offers a wide range of group fitness classes:

Cardio & HIIT:
- BodyCombat, BodyAttack, HIIT Zone

Mind & Body:
- Yoga, Pilates, BodyBalance

Strength:
- BodyPump, Pin-Loaded Circuit

Aqua:
- Aqua Aerobics (all levels)

Classes are included with Full Access and Health Club memberships. Check our timetable for specific times.

Q: Do you offer childcare?
A: Yes, [Centre Name] has childcare facilities:
- Ages: 6 weeks to 5 years
- Hours: Monday-Friday, 9am-1pm (session times vary)
- Cost: $4.90 per session
- Booking required: Call ahead to secure a spot

All staff are first aid trained and have working with children checks.

Q: Can I get a casual visit?
A: Yes, casual visits are available:

Pool Entry:
- Adult: $9.00
- Child (under 18): $6.90
- Family (2 adults + 2 kids): $27.30

Gym/Classes:
- Adult: $24.50
- Concession: $13.00

We also offer 10-visit passes if you plan to visit regularly.

Q: Do you offer concessions?
A: Yes, concession rates are available for:
- Seniors Card holders
- Health Care Card holders
- Student Card holders
- DVA Card holders

You'll need to present your valid concession card when signing up or visiting.`;

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Based on the following information from our leisure centre knowledge base, answer the question.\n\nKnowledge Base Information:\n${context}\n\nQuestion: ${question}\n\nProvide a helpful, professional response:`
        }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const answer = completion.choices[0]?.message?.content || 'No response generated';

    // Map of centre IDs to website URLs
    const centreWebsites: Record<string, string> = {
      albanycreek: 'https://www.albanycreeklc.com.au/',
      ascotvale: 'https://www.ascotvale.ymca.org.au/',
      auburnruth: 'https://www.auburnaquaticcentre.com.au/',
      bathurstmanning: 'https://www.bathurstindoorpool.com.au/',
      bright: 'https://www.brightsportscentre.com.au/',
      bundaberg: 'https://bundabergaquaticcentre.com.au/',
      burpengary: 'https://www.burpengaryralc.com.au/',
      canberraolympicpool: 'https://www.canberraolympicpool.com.au/',
      centrepointblayney: 'https://www.blaneyshire.nsw.gov.au/sport-recreation/centrepoint-recreation-centre',
      chinchilla: 'https://chinchillaaquaticandfitnesscentre.com.au/',
      civicreserve: 'https://www.civicreccentre.com.au/',
      dalbyaquaticcentre: 'https://dalbyaquaticcentre.com.au/',
      dannyfrawley: 'https://www.dannyfrawleycentre.com.au/',
      dicksonpools: 'https://www.dicksonpool.com.au/',
      eastfremantle: 'https://bactiveeastfremantle.com.au/',
      erindale: 'https://erindaleleisurecentre.com.au/',
      fernyhillswimmingpool: 'https://www.fernyhillspool.com.au/',
      greatlakes: 'https://greatlakesalc.com.au/',
      gungahlin: 'https://www.gungahlinleisurecentre.com.au/',
      gurriwanyarra: 'https://www.gurriwanyarrawc.com.au/',
      gympie: 'https://www.gympiearc.com.au/',
      higherstatemelbairport: 'https://higherstatemelbourneairport.com.au/',
      inverellaquaticcentre: 'https://inverellaquaticcentre.com.au/',
      jackhort: 'https://www.jackhortmcp.com.au/',
      keiloreastleisurecentre: 'https://www.movemv.com.au/keilor-east-leisure-centre/',
      knoxleisureworks: 'https://www.knoxleisureworks.com.au/',
      kurrikurri: 'https://www.kurrikurriafc.com.au/',
      lakeside: 'https://www.lakesideleisure.com.au/',
      loftus: 'https://www.loftusrecreationcentre.com.au/',
      manningmidcoasttaree: 'https://manningalc.com.au/',
      mansfieldswimmingpool: 'https://www.mansfieldswimmingpool.com.au/',
      michaelclarke: 'https://www.michaelclarkecentre.com.au/',
      michaelwenden: 'https://www.wendenpool.com.au/',
      millpark: 'https://www.millparkleisure.com.au/',
      monbulk: 'https://www.monbulkaquatic.com.au/',
      moree: 'https://www.moreeartesianaquaticcentre.com.au/',
      pelicanpark: 'https://www.pelicanparkrec.com.au/',
      portland: 'https://portlandleisurecentre.com.au/',
      queensparkpool: 'https://www.queensparktohfc.com.au/',
      robinvale: 'https://www.robinvalepool.com.au/',
      singleton: 'https://www.singletonaquaticcentre.com.au/',
      somerville: 'https://www.somervillerecreationcentre.com.au/',
      splashdevonport: 'https://splashdevonport.ymca.org.au/',
      stromlo: 'https://www.stromloleisurecentre.com.au/',
      summit: 'https://www.summitlc.com.au/',
      swanhill: 'https://swanhillleisurecentre.com.au/',
      swell: 'https://www.swell-belconnen.com.au/',
      swirl: 'https://www.swirlleisure.com.au/',
      tehiku: 'https://www.tehikucentre.nz/',
      tomaree: 'https://www.tomareeleisure.com.au/',
      trac: 'https://www.trac.org.au/',
      watermarc: 'https://www.watermarc.com.au/',
      whitlamleisurecentre: 'https://www.whitlamleisure.com.au/',
      whittleseaswimcentre: 'https://www.whittleseasc.com.au/',
      wollondilly: 'https://www.wollondillyleisure.com.au/',
      wulanda: 'https://www.wulandarec.com.au/',
      yarra: 'https://www.yarraleisure.com.au/',
      yarrambatparkgolfcourse: 'https://www.yarrambatgolf.com.au/',
      yawa: 'https://www.yawaaquatic.com.au/',
    };

    // Create sources with actual website URLs
    const sources = filteredResults.map((r: any) => {
      const meta = r.metadata || {};
      const centreId = meta.centre;
      if (centreId && centreWebsites[centreId]) {
        return {
          url: centreWebsites[centreId],
          title: meta.category || 'Website'
        };
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json({
      answer,
      sources,
    });
  } catch (error) {
    console.error('Error processing query:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      indexName: process.env.PINECONE_INDEX_NAME,
    });
    return NextResponse.json(
      {
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
