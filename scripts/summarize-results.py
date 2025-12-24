import json

with open('test-results.json', 'r') as f:
    data = json.load(f)

print('='*80)
print('CHATBOT TEST RESULTS SUMMARY')
print('='*80)
print()

# Overall stats
summary = data['summary']
print(f"Total Queries: {summary['total_queries']}")
print(f"Successful: {summary['successful_queries']} ({summary['successful_queries']/summary['total_queries']*100:.1f}%)")
print(f"With Information: {summary['queries_with_info']} ({summary['queries_with_info']/summary['total_queries']*100:.1f}%)")
print(f"Without Information: {summary['queries_without_info']}")
print(f"Failed (500 errors): {summary['failed_queries']} ({summary['failed_queries']/summary['total_queries']*100:.1f}%)")
print()

# Question performance
print('='*80)
print('PERFORMANCE BY QUESTION')
print('='*80)
for question, stats in data['by_question'].items():
    success_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"{question:<45} {stats['with_info']}/{stats['total']} ({success_rate:.0f}%) - Failed: {stats['failed']}")
print()

# Top performers
print('='*80)
print('TOP 15 PERFORMING CENTRES')
print('='*80)
sorted_centres = sorted(data['by_centre'].items(), key=lambda x: x[1]['with_info'], reverse=True)
for centre, stats in sorted_centres[:15]:
    success_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"{centre:<35} {stats['with_info']}/{stats['total']} ({success_rate:.0f}%)")
print()

# Bottom performers
print('='*80)
print('BOTTOM 15 PERFORMING CENTRES')
print('='*80)
for centre, stats in sorted_centres[-15:]:
    success_rate = (stats['with_info'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"{centre:<35} {stats['with_info']}/{stats['total']} ({success_rate:.0f}%) - Failed: {stats['failed']}")
print()

# Centres with all failures
failed_centres = [c for c, s in data['by_centre'].items() if s['failed'] == 10]
print('='*80)
print(f'CENTRES WITH ALL QUERIES FAILED ({len(failed_centres)} centres)')
print('='*80)
for centre in failed_centres:
    print(f"  {centre}")
print()

# Error types
print('='*80)
print('SAMPLE ERRORS (First 10)')
print('='*80)
for fail in data['failed_tests'][:10]:
    print(f"{fail['centre']:<30} {fail['question']:<40} {fail['error']}")
