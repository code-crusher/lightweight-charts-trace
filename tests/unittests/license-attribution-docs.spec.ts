/* eslint-disable
	@typescript-eslint/no-floating-promises,
	@typescript-eslint/no-unused-expressions,
	@typescript-eslint/tslint/config
*/
import { expect } from 'chai';
import { describe, it } from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const websiteRoot = path.join(repoRoot, 'website');

/**
 * Phrases that present a link to tradingview.com on the user's own website or
 * mobile application as a legal requirement of the Apache-2.0 license.
 *
 * Apache-2.0 Section 4 only requires retaining copyright and attribution
 * notices when distributing derivative works, so wording like this contradicts
 * the LICENSE file (see issue #1437) and must not appear in the docs, the
 * README, or the API doc comments.
 */
const forbiddenLinkRequirementPhrases: RegExp[] = [
	/(shall|you) add .* a? ?link to .* to the page of your (website|mobile application)/,
	/specifies that you add .* a link to/s,
	/license \*+requires\*+ specifying TradingView as the product creator/,
	/meeting this linking requirement/,
];

function read(filePath: string): string {
	expect(fs.existsSync(filePath), `${path.relative(repoRoot, filePath)} should exist`).to.be.true;
	return fs.readFileSync(filePath, 'utf8');
}

describe('License and attribution docs', () => {
	describe('must not claim a backlink is required by the Apache-2.0 license', () => {
		const filesToCheck: string[] = [
			path.join(repoRoot, 'README.md'),
			path.join(repoRoot, 'src', 'model', 'layout-options.ts'),
			path.join(websiteRoot, 'docs', 'intro.mdx'),
		];

		for (const filePath of filesToCheck) {
			const relativePath = path.relative(repoRoot, filePath);

			it(`should have no misleading license wording in ${relativePath}`, () => {
				const content = read(filePath);
				for (const phrase of forbiddenLinkRequirementPhrases) {
					expect(
						content,
						`${relativePath} must not claim that a backlink is a license requirement (matching ${phrase})`
					).to.not.match(phrase);
				}
			});
		}

		it('should have no misleading license wording in any live docs version', () => {
			const versions: string[] = JSON.parse(read(path.join(websiteRoot, 'versions.json')));
			expect(versions).to.not.be.empty;

			for (const version of versions) {
				const versionDir = path.join(websiteRoot, 'versioned_docs', `version-${version}`);
				const introPath = fs.existsSync(path.join(versionDir, 'intro.mdx'))
					? path.join(versionDir, 'intro.mdx')
					: path.join(versionDir, 'intro.md');

				const content = read(introPath);
				for (const phrase of forbiddenLinkRequirementPhrases) {
					expect(
						content,
						`versioned_docs/version-${version} must not claim that a backlink is a license requirement (matching ${phrase})`
					).to.not.match(phrase);
				}
			}
		});
	});

	describe('must state the actual Apache-2.0 attribution requirement', () => {
		const introPath = path.join(websiteRoot, 'docs', 'intro.mdx');

		it('should require retaining the NOTICE attribution notice when distributing derivative works', () => {
			const intro = read(introPath);

			// The obligation must be about retaining notices when distributing
			// derivative works, not about a page on the user's own site.
			expect(intro).to.include('attribution notice from the [`NOTICE`]');
			expect(intro).to.include('when you distribute any derivative works');
		});

		it('should keep the tradingview.com link request, but as an optional courtesy', () => {
			const intro = read(introPath);
			expect(intro).to.include('https://www.tradingview.com');
			// "grateful", not "shall"/"required", for the link itself
			expect(intro).to.include("we'd be grateful");
		});

		it('should describe the NOTICE obligation in the README', () => {
			const readme = read(path.join(repoRoot, 'README.md'));
			expect(readme).to.include('[NOTICE](./NOTICE)');
			expect(readme).to.include('Sections 4(c) and 4(d)');
		});

		it('should not state a link requirement in the attributionLogo API docs', () => {
			const layoutOptions = read(path.join(repoRoot, 'src', 'model', 'layout-options.ts'));
			const attributionLogoIndex = layoutOptions.indexOf('attributionLogo: boolean');
			expect(attributionLogoIndex).to.be.greaterThan(-1);

			const docComment = layoutOptions.slice(Math.max(0, attributionLogoIndex - 1000), attributionLogoIndex);
			expect(docComment, 'the doc comment should state what the license actually requires')
				.to.include('requires\n\t * retaining the "attribution notice" from the NOTICE file when you\n\t * distribute any derivative works');
			expect(docComment, 'the backlink must be offered as a courtesy, not as a requirement')
				.to.include("we'd be grateful");
		});
	});
});
