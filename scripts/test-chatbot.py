import json
import requests
import time
from pathlib import Path

# Common questions to test
COMMON_QUESTIONS = [
    "What are your opening hours?",
    "How much does a membership cost?",
    "Do you have a pool?",
    "What fitness classes do you offer?",
    "Do you have a gym?",
    "What are your casual entry prices?",
    "Do you offer concession rates?",
    "What facilities do you have?",
    "Do you have childcare services?",
    "How do I contact you?"
]

# Centre IDs (from the combined data)
CENTRE_IDS = [
    'albanycreek', 'ascotvale', 'auburnruth', 'bathurstmanning', 'bright',
    'bundaberg', 'burpengary', 'canberraolympicpool', 'centrepointblayney',
    'chinchilla', 'civicreserve', 'dalbyaquaticcentre', 'dannyfrawley',
    'dicksonpools', 'eastfremantle', 'erindale', 'fernyhillswimmingpool',
    'greatlakes', 'gungahlin', 'gurriwanyarra', 'gympie', 'higherstatemelbairport',
    'inverellaquaticcentre', 'jackhort', 'keiloreastleisurecentre', 'knoxleisureworks',
    'kurrikurri', 'lakeside', 'loftus', 'manningmidcoasttaree', 'mansfieldswimmingpool',
    'michaelclarke', 'michaelwenden', 'millpark', 'monbulk', 'moree',
    'pelicanpark', 'portland', 'queensparkpool', 'robinvale', 'singleton',
    'somerville', 'splashdevonport', 'stromlo', 'summit', 'swanhill',
    'swell', 'swirl', 'tehiku', 'tomaree', 'trac', 'watermarc',
    'whitlamleisurecentre', 'whittleseaswimcentre', 'wollondilly', 'wulanda',
    'yarra', 'yarrambatparkgolfcourse', 'yawa'
]

API_URL = 'http://localhost:3001/api/query'

def test_question(centre_id, question):
    """Test a single question for a centre"""
    try:
        response = requests.post(
            API_URL,
            json={'question': question, 'centre': centre_id},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            answer = data.get('answer', '')
            sources = data.get('sources', [])

            # Check if answer is meaningful (not a "don't have info" response)
            no_info_phrases = [
                "don't have specific information",
                "don't have information",
                "no information available",
                "cannot find",
                "not available"
            ]

            has_info = not any(phrase in answer.lower() for phrase in no_info_phrases)

            return {
                'success': True,
                'has_info': has_info,
                'answer_length': len(answer),
                'sources_count': len(sources),
                'answer': answer[:200]  # First 200 chars for review
            }
        else:
            return {
                'success': False,
                'error': f'Status {response.status_code}',
                'has_info': False
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'has_info': False
        }

def main():
    print("="*80)
    print("CHATBOT TESTING - 10 Common Questions Across All Centres")
    print("="*80)
    print(f"Testing {len(CENTRE_IDS)} centres with {len(COMMON_QUESTIONS)} questions each")
    print(f"Total queries: {len(CENTRE_IDS) * len(COMMON_QUESTIONS)}")
    print()

    results = {
        'summary': {
            'total_queries': 0,
            'successful_queries': 0,
            'queries_with_info': 0,
            'queries_without_info': 0,
            'failed_queries': 0
        },
        'by_question': {},
        'by_centre': {},
        'failed_tests': []
    }

    # Initialize question stats
    for question in COMMON_QUESTIONS:
        results['by_question'][question] = {
            'total': 0,
            'with_info': 0,
            'without_info': 0,
            'failed': 0
        }

    # Test each centre
    for i, centre_id in enumerate(CENTRE_IDS, 1):
        print(f"\n[{i}/{len(CENTRE_IDS)}] Testing {centre_id}...")

        centre_results = {
            'total': 0,
            'with_info': 0,
            'without_info': 0,
            'failed': 0,
            'questions': {}
        }

        for question in COMMON_QUESTIONS:
            results['summary']['total_queries'] += 1
            centre_results['total'] += 1
            results['by_question'][question]['total'] += 1

            result = test_question(centre_id, question)
            centre_results['questions'][question] = result

            if result['success']:
                results['summary']['successful_queries'] += 1

                if result['has_info']:
                    results['summary']['queries_with_info'] += 1
                    centre_results['with_info'] += 1
                    results['by_question'][question]['with_info'] += 1
                    print(f"  [+] {question[:50]:<50} [INFO]")
                else:
                    results['summary']['queries_without_info'] += 1
                    centre_results['without_info'] += 1
                    results['by_question'][question]['without_info'] += 1
                    print(f"  [ ] {question[:50]:<50} [NO INFO]")
            else:
                results['summary']['failed_queries'] += 1
                centre_results['failed'] += 1
                results['by_question'][question]['failed'] += 1
                results['failed_tests'].append({
                    'centre': centre_id,
                    'question': question,
                    'error': result.get('error', 'Unknown error')
                })
                print(f"  [X] {question[:50]:<50} [FAILED: {result.get('error', 'Unknown')}]")

            # Rate limiting - wait 1 second between questions
            time.sleep(1)

        results['by_centre'][centre_id] = centre_results

        # Summary for this centre
        info_rate = (centre_results['with_info'] / centre_results['total'] * 100) if centre_results['total'] > 0 else 0
        print(f"  Centre Summary: {centre_results['with_info']}/{centre_results['total']} questions answered ({info_rate:.1f}%)")

        # Wait 2 seconds between centres
        time.sleep(2)

    # Final summary
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)

    print(f"\nOverall Statistics:")
    print(f"  Total Queries: {results['summary']['total_queries']}")
    print(f"  Successful: {results['summary']['successful_queries']}")
    print(f"  With Information: {results['summary']['queries_with_info']} ({results['summary']['queries_with_info']/results['summary']['total_queries']*100:.1f}%)")
    print(f"  Without Information: {results['summary']['queries_without_info']} ({results['summary']['queries_without_info']/results['summary']['total_queries']*100:.1f}%)")
    print(f"  Failed: {results['summary']['failed_queries']}")

    print(f"\nResults by Question:")
    for question, stats in results['by_question'].items():
        info_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"  {question[:60]:<60} {stats['with_info']}/{stats['total']} ({info_rate:.1f}%)")

    print(f"\nTop 10 Best Performing Centres:")
    sorted_centres = sorted(
        results['by_centre'].items(),
        key=lambda x: x[1]['with_info'],
        reverse=True
    )
    for centre_id, stats in sorted_centres[:10]:
        info_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"  {centre_id:<30} {stats['with_info']}/{stats['total']} ({info_rate:.1f}%)")

    print(f"\nBottom 10 Performing Centres:")
    for centre_id, stats in sorted_centres[-10:]:
        info_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"  {centre_id:<30} {stats['with_info']}/{stats['total']} ({info_rate:.1f}%)")

    if results['failed_tests']:
        print(f"\nFailed Tests ({len(results['failed_tests'])}):")
        for fail in results['failed_tests'][:20]:  # Show first 20
            print(f"  {fail['centre']} - {fail['question'][:40]} - {fail['error']}")

    # Save detailed results to JSON
    output_file = Path('c:/Projects/centre2/test-results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nDetailed results saved to: {output_file}")
    print("="*80)

if __name__ == '__main__':
    main()
